const TOKEN_KEY = 'em_token';
const USER_KEY = 'em_user';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export async function login(username, password) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Login failed');
  }

  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Register a new user account.
 *
 * BACKEND IMPLEMENTATION REQUIRED:
 * - Endpoint: POST /api/auth/register
 * - Body: { username, email, password }
 * - Backend tasks:
 *   1. Validate inputs (valid email, password length >= 8, username alphanumeric).
 *   2. Verify username and email are unique in the database.
 *   3. Hash password using bcrypt or argon2 (e.g. bcrypt.hash(password, 10)).
 *   4. Persist user to DB.
 *   5. Return JWT token and user info: { token, user: { id, username, email } }.
 *   6. Status codes: 201 Created on success, 400 Bad Request, 409 Conflict if duplicate.
 */
export async function register(username, email, password) {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data.error ||
        'Registration failed. Backend endpoint POST /api/auth/register is not yet implemented.'
    );
  }

  if (data.token) {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }
  return data.user;
}

/**
 * Initiate Google OAuth authentication.
 *
 * BACKEND IMPLEMENTATION REQUIRED:
 * - Strategy 1 (OAuth2 Redirect flow):
 *   1. Route: GET /api/auth/google -> passport.authenticate('google', { scope: ['profile', 'email'] })
 *   2. Callback: GET /api/auth/google/callback -> passport.authenticate('google', { failureRedirect: '/login' })
 *   3. Backend issues JWT token on callback and redirects to frontend (e.g. /login?token=... or via secure cookie).
 *   4. Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.
 *
 * - Strategy 2 (Google One-Tap / GIS Client ID token verification):
 *   1. Frontend obtains Google credential JWT token via Google Identity Services button/popup.
 *   2. Route: POST /api/auth/google -> verifies credential using google-auth-library.
 *   3. Backend finds or creates user record and issues JWT session token.
 */
export async function loginWithGoogle() {
  // Test if endpoint exists before redirecting to prevent unhandled 404 page in dev
  try {
    const check = await fetch(`${API_URL}/api/auth/google`, { method: 'HEAD' });
    if (check.ok || check.status === 302) {
      window.location.href = `${API_URL}/api/auth/google`;
      return;
    }
  } catch {
    // Network or server unreachable
  }

  throw new Error(
    'Google OAuth backend endpoint (GET /api/auth/google) is not yet implemented.'
  );
}

