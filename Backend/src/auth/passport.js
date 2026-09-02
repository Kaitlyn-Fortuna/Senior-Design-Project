import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { findByUsername, findById } from './users.js';

export function setupPassport() {
  passport.use(
    new LocalStrategy((username, password, done) => {
      const user = findByUsername(username);
      if (!user) {
        return done(null, false, { message: 'Invalid username' });
      }
      if (!bcrypt.compareSync(password, user.passwordHash)) {
        return done(null, false, { message: 'Invalid password' });
      }
      return done(null, { id: user.id, username: user.username });
    }),
  );

  passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: config.jwtSecret,
      },
      (payload, done) => {
        const user = findById(payload.id).then((user) => {
          if (user) {
            return done(null, { id: user.id, username: user.username });
          }
          return done(null, false);
        }).catch((err) => {
          return done(err, false);
        });
      },
    ),
  );
}