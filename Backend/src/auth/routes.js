import { Router } from 'express';
import passport from 'passport';
import session from 'express-session';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const router = Router();

function issueTokenResponse(req, res) {
  const token = jwt.sign(
    { id: req.user.id, username: req.user.username },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
  return res.json({ token, user: req.user });
}

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

// --- OAuth2/OIDC sub-router ---
// Session is scoped to just these routes: it only exists to hold state &
// nonce during the redirect round-trip with Auth0/Google/Facebook, so it
// has no business being attached to /login or /me above.
const oauthRouter = Router();

oauthRouter.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 5 * 60 * 1000, // only needs to survive the redirect
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // must survive the top-level redirect back from the provider
    },
  }),
);

// Auth0
oauthRouter.get('/auth0/login', passport.authenticate('openidconnect'));

oauthRouter.get(
  '/auth0/callback',
  passport.authenticate('openidconnect', {
    session: false,
    failureRedirect: '/login?error=oauth_failed',
  }),
  issueTokenResponse,
);

// Google
oauthRouter.get('/google', passport.authenticate('google'));

oauthRouter.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/login?error=oauth_failed',
  }),
  issueTokenResponse,
);

// Facebook
oauthRouter.get('/facebook', passport.authenticate('facebook'));

oauthRouter.get(
  '/facebook/callback',
  passport.authenticate('facebook', {
    session: false,
    failureRedirect: '/login?error=oauth_failed',
  }),
  issueTokenResponse,
);

router.use(oauthRouter);

export default router;