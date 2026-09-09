import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3000,

  //TODO: change these in production
  
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me-eventually',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  influx: {
    url: process.env.INFLUX_URL || '',
    token: process.env.INFLUX_TOKEN || '',
    org: process.env.INFLUX_ORG || '',
    bucket: process.env.INFLUX_BUCKET || '',
  },
  serial: {
    path: process.env.SERIAL_PORT || '',
    baudRate: Number(process.env.SERIAL_BAUD) || 9600,
  },
  auth0: {
    domain: process.env.AUTH0_DOMAIN || '',
    clientID: process.env.AUTH0_CLIENT_ID || '',
    clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
    callbackURL: process.env.AUTH0_CALLBACK_URL || '/auth/oauth2/redirect',
  },
};