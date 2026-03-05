# Render Deployment Guide

## Project Status
✅ **API-Only Mode**: This backend serves only API endpoints for mobile app consumption
✅ **Vite Removed**: No frontend building required
✅ **TypeScript**: Compiles to JavaScript in `dist/` directory

## Render Configuration

### Build Settings
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Node Version**: 20.x (matches package.json)

### Environment Variables
Add these in Render dashboard:
```
NODE_ENV=production
DATABASE_URL=your_database_url
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
SESSION_SECRET=your_session_secret
```

### Health Check
- **Health Check Path**: `/health`
- **Expected Response**: `{"status":"OK","timestamp":"...","port":"..."}`

## Local Development
```bash
# Install dependencies
npm install

# Development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## API Endpoints
- `GET /health` - Health check
- `POST /api/diag/echo` - Diagnostic endpoint
- All other API routes defined in `routes.ts`

## CORS Configuration
- **Origin**: `*` (allows all origins for mobile app)
- **Credentials**: `false` (required when using wildcard origin)