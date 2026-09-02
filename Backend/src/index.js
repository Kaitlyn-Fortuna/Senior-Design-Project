import http from 'http';
import express from 'express';
import cors from 'cors';
import passport from 'passport';
import { config } from './config.js';
import { setupPassport } from './auth/passport.js';
import authRoutes from './auth/routes.js';

const app = express();
const server = http.createServer(app);

setupPassport();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(passport.initialize());

app.get('/', (_req, res) => {
  res.json({
    service: 'energy-monitor',
    message: 'This is the API. Open the Vue app at http://localhost:5173',
    endpoints: ['/api/health', '/api/auth/login'],
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'energy-monitor' });
});

app.use('/api/auth', authRoutes);


server.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
});

