import { Strategy as OpenIDConnectStrategy } from 'passport-openidconnect';
import { findOrCreateFromAuth0 } from './users.js'; // Auth0

export function setupPassport() {
  // ...existing LocalStrategy and JwtStrategy...

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
      (issuer, profile, done) => {
        try {
          const user = findOrCreateFromAuth0(profile);
          return done(null, { id: user.id, username: user.username });
        } catch (err) {
          return done(err);
        }
      },
    ),
  );
}