import { createClient } from '@supabase/supabase-js';
import fs from 'fs-extra';
import archiver from 'archiver';
import path from 'path';
import { storage } from './storage';

// These should be set in environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

export class BackupService {
  private client: any;
  private deployMode: 'cloud' | 'local' = 'local';
  private localBackupDir: string;

  constructor() {
    this.localBackupDir = path.join(process.cwd(), 'backups');
    fs.ensureDirSync(this.localBackupDir);

    if (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith("http")) {
      try {
        this.client = createClient(SUPABASE_URL, SUPABASE_KEY);
        this.deployMode = 'cloud';
      } catch (e) {
        // Silent fallback to local
        this.deployMode = 'local';
      }
    } else {
      this.deployMode = 'local';
    }
  }

  async createBackup(userId: string): Promise<{ success: boolean; size: number; message: string }> {
    try {
      console.log(`[Backup] Starting backup for user: ${userId}`);

      // 1. Create a temporary zip of the database
      const dbPath = path.join(process.cwd(), 'database.db');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `backup_${timestamp}_GMT.zip`;
      const tempPath = path.join(process.cwd(), fileName);

      if (!await fs.pathExists(dbPath)) {
        throw new Error("Database file (database.db) not found");
      }

      await this.zipDatabase(dbPath, tempPath);

      const stats = await fs.stat(tempPath);
      const size = stats.size;
      console.log(`[Backup] Zip created. Size: ${size} bytes`);

      if (this.deployMode === 'cloud' && this.client) {
        console.log(`[Backup] Checking Supabase bucket 'momo-backups'...`);

        // Ensure bucket exists
        const { data: bucketData, error: bucketError } = await this.client.storage.getBucket('momo-backups');

        if (bucketError && (bucketError.message?.includes('not found') || (bucketError as any).status === 404)) {
          console.log(`[Backup] Bucket 'momo-backups' not found. Attempting to create it...`);
          const { error: createError } = await this.client.storage.createBucket('momo-backups', {
            public: false,
            fileSizeLimit: 52428800, // 50MB limit
            allowedMimeTypes: ['application/zip']
          });

          if (createError) {
            console.error(`[Backup] Failed to create bucket:`, createError);
            throw new Error(`Supabase bucket 'momo-backups' missing and auto-creation failed: ${createError.message}. Please create it manually.`);
          }
          console.log(`[Backup] Bucket 'momo-backups' created successfully.`);
        } else if (bucketError) {
          console.error(`[Backup] Error checking bucket:`, bucketError);
          throw bucketError;
        }

        console.log(`[Backup] Uploading to Supabase bucket 'momo-backups'...`);
        const fileContent = await fs.readFile(tempPath);
        const cloudFileName = `${userId}/${fileName}`;

        const { data, error } = await this.client
          .storage
          .from('momo-backups')
          .upload(cloudFileName, fileContent, {
            contentType: 'application/zip',
            upsert: true
          });

        if (error) {
          console.error(`[Backup] Supabase upload error:`, error);
          throw error;
        }

        console.log(`[Backup] Upload successful: ${cloudFileName}`);
        // Cleanup temp file
        await fs.remove(tempPath);
      } else {
        console.log(`[Backup] Using local mode...`);
        // Local Mode: Move to backups/${userId}/ folder
        const userBackupDir = path.join(this.localBackupDir, userId);
        await fs.ensureDir(userBackupDir);

        const targetPath = path.join(userBackupDir, fileName);
        await fs.move(tempPath, targetPath);
        console.log(`[Backup] Local backup saved: ${targetPath}`);
      }

      // Update usage
      await storage.updateStorageUsage(userId, size);

      return { success: true, size, message: `Backup successful (${this.deployMode})` };

    } catch (error: any) {
      console.error("Backup failed:", error);
      return { success: false, size: 0, message: error.message };
    }
  }

  async listBackups(userId: string) {
    if (this.deployMode === 'cloud' && this.client) {
      const { data, error } = await this.client
        .storage
        .from('momo-backups')
        .list(userId, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) {
        console.error("Error listing cloud backups:", error);
        return [];
      }

      return data.map((item: any) => ({
        id: item.name,
        name: item.name,
        size: item.metadata?.size || 0,
        created_at: item.created_at,
      }));
    } else {
      // Local Mode: Read from backups/${userId}/
      try {
        const userBackupDir = path.join(this.localBackupDir, userId);
        if (!await fs.pathExists(userBackupDir)) return [];

        const files = await fs.readdir(userBackupDir);
        const fileStats = await Promise.all(files.map(async (file) => {
          const filePath = path.join(userBackupDir, file);
          const stats = await fs.stat(filePath);
          return {
            id: file,
            name: file,
            size: stats.size,
            created_at: stats.birthtime.toISOString()
          };
        }));

        // Sort desc
        return fileStats.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      } catch (e) {
        console.error("Error listing local backups:", e);
        return [];
      }
    }
  }

  async restoreBackup(userId: string, backupId: string): Promise<boolean> {
    try {
      let restoreSourcePath: string;

      if (this.deployMode === 'cloud' && this.client) {
        // 1. Download
        const { data, error } = await this.client
          .storage
          .from('momo-backups')
          .download(`${userId}/${backupId}`);

        if (error) throw error;

        // 2. Save to temp
        const buffer = Buffer.from(await data.arrayBuffer());
        restoreSourcePath = path.join(process.cwd(), 'restore_temp.zip');
        await fs.writeFile(restoreSourcePath, buffer);
      } else {
        // Local Mode: Use backups/${userId}/${backupId}
        restoreSourcePath = path.join(this.localBackupDir, userId, backupId);
        if (!await fs.pathExists(restoreSourcePath)) {
          throw new Error("Backup file not found locally");
        }
      }

      // 3. Extract and replace DB (Warning: Dangerous in production without checks)
      // This implementation is a placeholder. Real restore requires shutting down DB connections.
      console.log(`[Mock Restore] Would restore from ${restoreSourcePath} to database.db`);

      // Cleanup temp download if cloud
      if (this.deployMode === 'cloud') {
        await fs.remove(restoreSourcePath);
      }

      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  private zipDatabase(source: string, out: string): Promise<void> {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = fs.createWriteStream(out);

    return new Promise((resolve, reject) => {
      archive
        .file(source, { name: 'database.db' })
        .on('error', (err: any) => reject(err))
        .pipe(stream);

      stream.on('close', () => resolve());
      archive.finalize();
    });
  }
}

export const backupService = new BackupService();
