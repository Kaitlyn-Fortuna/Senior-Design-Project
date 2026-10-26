import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3000,

  //TODO: change these in production
  
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me-eventually',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  frontendUrl: process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ||
      'http://localhost:3000/api/auth/google/callback',
  },
  
  socketTimer: Number(process.env.SOCKET_TIMER) || 1000,
  
  database: {
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'temporaryPassword',
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE || 'postgres',
  },
  serial: {
    path: process.env.SERIAL_PORT || '',
    baudRate: Number(process.env.SERIAL_BAUD) || 9600,
  },
};