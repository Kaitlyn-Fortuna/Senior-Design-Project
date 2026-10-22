import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { findByUsername, findById, findOrCreateGoogleUser } from './users.js';

export function setupPassport() {
  // Username/password login
  passport.use(
    new LocalStrategy((username, password, done) => {
      try {
        const user = findByUsername(username);
        if (!user) {
          return done(null, false, { message: 'Invalid username' });
        }
        // Google-only accounts have no password hash
        if (!user.passwordHash || !bcrypt.compareSync(password, user.passwordHash)) {
          return done(null, false, { message: 'Invalid password' });
        }
        return done(null, { id: user.id, username: user.username });
      } catch (err) {
        return done(err);
      }
    }),
  );

  // Protects API routes using a Bearer token
  passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: config.jwtSecret,
      },
      (payload, done) => {
        try {
          const user = findById(payload.id);
          if (user) {
            return done(null, { id: user.id, username: user.username });
          }
          return done(null, false);
        } catch (err) {
          return done(err, false);
        }
      },
    ),
  );

  // Only register Google when credentials are configured
  if (config.google.clientId && config.google.clientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: config.google.clientId,
          clientSecret: config.google.clientSecret,
          callbackURL: config.google.callbackUrl,
        },
        (accessToken, refreshToken, profile, done) => {
          try {
            const user = findOrCreateGoogleUser(profile);
            return done(null, { id: user.id, username: user.username });
          } catch (err) {
            // done(null, false) triggers failureRedirect; done(err) would skip it
            return done(null, false, { message: err.message });
          }
        },
      ),
    );
  } else {
    console.warn('Google OAuth not configured: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  }
}