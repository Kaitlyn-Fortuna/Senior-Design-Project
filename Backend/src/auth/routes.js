import { Router } from 'express';
import passport from 'passport';
import session from 'express-session';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const router = Router();

router.post('/login', (req, res, next) => {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(401).json({ error: info?.message || 'Unauthorized' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn },
    );

    return res.json({ token, user });
  })(req, res, next);
});

router.get('/me', passport.authenticate('jwt', { session: false }), (req, res) => {
  res.json({ user: req.user });
});

// Auth0 routes need a session only to hold OIDC state/nonce during the
// redirect round-trip. Scoped to /auth so the rest of the API stays stateless.
router.use(
  '/auth',
  session({
    secret: config.jwtSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 5 * 60 * 1000 }, // only needs to survive the redirect
  }),
);

router.get('/auth/login', passport.authenticate('openidconnect'));

router.get(
  '/auth/oauth2/redirect',
  passport.authenticate('openidconnect', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    // req.user is the { id, username } object returned by the
    // OpenIDConnectStrategy verify callback in passport.js
    const token = jwt.sign(
      { id: req.user.id, username: req.user.username },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn },
    );

    return res.json({ token, user: req.user });
    // Alternatively, redirect to your frontend with the token:
    // return res.redirect(`${config.corsOrigin}/auth/callback?token=${token}`);
  },
);

export default router;