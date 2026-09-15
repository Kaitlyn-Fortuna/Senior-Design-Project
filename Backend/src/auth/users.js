import bcrypt from 'bcryptjs';

const users = [
  {
    id: 1,
    username: 'demo',
    passwordHash: bcrypt.hashSync('demo123', 10),
  },
];

let nextId = users.length + 1;

export function findByUsername(username) {
  return users.find((user) => user.username === username);
}

export function findById(id) {
  return users.find((user) => user.id === id);
}

function findByProviderId(provider, providerId) {
  return users.find(
    (user) => user.provider === provider && user.providerId === providerId,
  );
}

// Shared find-or-create for any OAuth2/OIDC provider (Auth0, Google, Facebook, ...).
// `profile` is Passport's normalized profile shape, so this works unchanged
// across strategies as long as they populate profile.id / displayName / emails.
export async function findOrCreateFromProvider(provider, profile) {
  let user = findByProviderId(provider, profile.id);
  if (!user) {
    user = {
      id: nextId++,
      username:
        profile.displayName ||
        profile.emails?.[0]?.value ||
        `${provider}:${profile.id}`,
      provider,
      providerId: profile.id,
      passwordHash: null, // no local password for federated users
    };
    users.push(user);
  }
  return user;
}