import bcrypt from 'bcryptjs';

const users = [
  {
    id: 1,
    username: 'demo',
    passwordHash: bcrypt.hashSync('demo123', 10),
  },
];

export function findByUsername(username) {
  return users.find((user) => user.username === username);
}

export function findById(id) {
  return users.find((user) => user.id === id);

  export function findOrCreateFromAuth0(profile) {
  let user = users.find((u) => u.auth0Id === profile.id);
  if (!user) {
    user = {
      id: users.length + 1,
      username: profile.displayName || profile.emails?.[0]?.value || profile.id,
      auth0Id: profile.id,
      passwordHash: null, // no local password for Auth0 users
    };
    users.push(user);
  }
  return user;
}

}
