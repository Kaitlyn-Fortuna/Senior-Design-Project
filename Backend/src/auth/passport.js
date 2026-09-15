import { Strategy as OpenIDConnectStrategy } from 'passport-openidconnect';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import passport from 'passport';
import { config } from '../config.js';
import { findOrCreateFromProvider } from './users.js';

export function setupPassport() {
  // ...existing LocalStrategy and JwtStrategy...

  // --- Auth0 (OpenID Connect) ---
  passport.use(
    new OpenIDConnectStrategy(
      {
        issuer: `https://${config.auth0.domain}/`,
        authorizationURL: `https://${config.auth0.domain}/authorize`,
        tokenURL: `https://${config.auth0.domain}/oauth/token`,
        userInfoURL: `https://${config.auth0.domain}/userinfo`,
        clientID: config.auth0.clientID,
        clientSecret: config.auth0.clientSecret,
        callbackURL: config.auth0.callbackURL,
        scope: ['profile', 'email'],
      },
      async (issuer, profile, done) => {
        try {
          const user = await findOrCreateFromProvider('auth0', profile);
          return done(null, { id: user.id, username: user.username });
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  // --- Google ---
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientID,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackURL,
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await findOrCreateFromProvider('google', profile);
          return done(null, { id: user.id, username: user.username });
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  // --- Facebook ---
  passport.use(
    new FacebookStrategy(
      {
        clientID: config.facebook.clientID,
        clientSecret: config.facebook.clientSecret,
        callbackURL: config.facebook.callbackURL,
        profileFields: ['id', 'displayName', 'emails'],
        state: true, // CSRF protection for the OAuth2 redirect
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await findOrCreateFromProvider('facebook', profile);
          return done(null, { id: user.id, username: user.username });
        } catch (err) {
          return done(err);
        }
      },
    ),
  );
}