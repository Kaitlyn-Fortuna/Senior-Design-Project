import { Router } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const router = Router();

const googleEnabled = Boolean(config.google.clientId && config.google.clientSecret);

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}

router.post('/login', (req, res, next) => {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(401).json({ error: info?.message || 'Unauthorized' });
    }

    return res.json({ token: signToken(user), user });
  })(req, res, next);
});

// Step 1: send the browser to Google
router.get('/google', (req, res, next) => {
  if (!googleEnabled) {
    return res.redirect(`${config.frontendUrl}/login?error=google_not_configured`);
  }
  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })(req, res, next);
});

// Step 2: Google sends the browser back here
router.get('/google/callback', (req, res, next) => {
  if (!googleEnabled) {
    return res.redirect(`${config.frontendUrl}/login?error=google_not_configured`);
  }
  return passport.authenticate('google', { session: false }, (err, user) => {
    if (err || !user) {
      return res.redirect(`${config.frontendUrl}/login?error=google`);
    }
    const token = signToken(user);
    return res.redirect(
      `${config.frontendUrl}/login?token=${encodeURIComponent(token)}`,
    );
  })(req, res, next);
});

router.get('/me', passport.authenticate('jwt', { session: false }), (req, res) => {
  res.json({ user: req.user });
});

export default router;