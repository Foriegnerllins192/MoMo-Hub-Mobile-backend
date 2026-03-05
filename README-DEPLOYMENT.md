# Render Deployment Guide

## Project Status
✅ **Hybrid Mode**: Backend API + Vite development server
✅ **Vite Enabled**: Development mode serves Vite, production serves API only
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

## Development vs Production

### Development Mode (NODE_ENV != "production")
- Vite development server enabled
- Hot module replacement (HMR) available
- Serves basic HTML template at root

### Production Mode (NODE_ENV = "production")
- API-only mode
- Root path returns API information
- All API endpoints available

## Local Development
```bash
# Install dependencies
npm install

# Development mode (with Vite + hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Dependencies
- **Vite**: `^7.3.0` (in dependencies for Render)
- **@vitejs/plugin-react**: `^4.7.0` (in dependencies)
- **nanoid**: `^5.0.8` (in dependencies)
- **@replit/vite-plugin-runtime-error-modal**: `^0.0.3` (in dependencies)

## API Endpoints
- `GET /health` - Health check
- `POST /api/diag/echo` - Diagnostic endpoint
- All other API routes defined in `routes.ts`

## CORS Configuration
- **Origin**: `*` (allows all origins for mobile app)
- **Credentials**: `false` (required when using wildcard origin)