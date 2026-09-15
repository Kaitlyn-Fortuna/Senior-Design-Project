import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3000,

  // Change these in production!!!

  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me-eventually',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',

  // Separate from jwtSecret on purpose: this only signs the short-lived
  // session cookie used to hold OAuth2/OIDC state during the redirect
  // round-trip for Auth0/Google/Facebook logins. Never issued to clients.
  sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret-change-me-eventually',

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
    callbackURL: process.env.AUTH0_CALLBACK_URL || '/api/auth/auth0/callback',
  },
  google: {
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
  },
  facebook: {
    clientID: process.env.FACEBOOK_CLIENT_ID || '',
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
    callbackURL: process.env.FACEBOOK_CALLBACK_URL || '/api/auth/facebook/callback',
  },
};