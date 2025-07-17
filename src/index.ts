import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Main server entry point
 */

import { createApp } from './api/app';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST
  || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

// Create and start server
const app = createApp();

const server = app.listen(PORT, () => {
  const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`🚀 X Profile Name Tag Generator is running!`);
  console.log(`📍 Server: http://${displayHost}:${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📋 API Docs: http://${displayHost}:${PORT}/api/name-tag/options`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export { app, server };