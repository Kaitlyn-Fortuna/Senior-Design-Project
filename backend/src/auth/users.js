// In-memory user store. Replace with a real database when you're ready.
const users = [];
let nextId = 1;

export function findByUsername(username) {
  if (!username) return null;
  const name = String(username).toLowerCase();
  return users.find((u) => u.username.toLowerCase() === name) || null;
}

export function findById(id) {
  // String compare so it works whether the JWT payload stores 1 or "1"
  return users.find((u) => String(u.id) === String(id)) || null;
}

export function findOrCreateGoogleUser(profile) {
  if (!profile?.id) {
    throw new Error('Invalid Google profile: missing id');
  }

  const emailEntry = profile.emails?.[0];
  const email = emailEntry?.value?.toLowerCase();

  if (!email) {
    throw new Error('Google account has no email address');
  }

  if (emailEntry.verified === false) {
    throw new Error('Google email is not verified');
  }

  let user = users.find((u) => u.googleId === profile.id || u.email === email);

  if (!user) {
    user = {
      id: nextId++,
      username: email,
      email,
      googleId: profile.id,
      displayName: profile.displayName,
      passwordHash: null, // Google-only account, no password login
    };
    users.push(user);
  } else if (!user.googleId) {
    user.googleId = profile.id; // link Google to an existing account
  }

  return user;
}