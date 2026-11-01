import { disconnectSocket } from "./socket";

const TOKEN_KEY = 'em_token';
const USER_KEY = 'em_user';
const OAUTH_ERROR_KEY = 'em_oauth_error';
const API_URL = import.meta.env.VITE_API_URL || '';

const OAUTH_ERRORS = {
  google: 'Google sign-in failed or was cancelled. Please try again.',
  google_not_configured: 'Google sign-in is not configured on the server.',
};

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
  disconnectSocket();
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Register a new user account.
 *
 * BACKEND IMPLEMENTATION REQUIRED:
 * - Endpoint: POST /api/auth/register
 * - Body: { username, email, password }
 * - Returns: { token, user: { id, username, email } }
 * - Status codes: 201 Created, 400 Bad Request, 409 Conflict if duplicate.
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
 * Start Google OAuth. Must be a full-page navigation (not fetch) so the
 * browser can follow the redirect to Google and back.
 */
export function loginWithGoogle() {
  window.location.href = `${API_URL}/api/auth/google`;
}

/**
 * Returns (and clears) the error message left by a failed Google sign-in.
 * Call it from the login page to display the message.
 */
export function consumeOAuthError() {
  const message = sessionStorage.getItem(OAUTH_ERROR_KEY);
  sessionStorage.removeItem(OAUTH_ERROR_KEY);
  return message;
}

/**
 * Runs once at startup (from main.js), before the app renders.
 * Handles the redirect back from the backend: /login?token=... or ?error=...
 */
export async function completeOAuthLogin() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const error = params.get('error');
  if (!token && !error) return;

  // Remove the token from the address bar and history right away
  window.history.replaceState({}, '', window.location.pathname);

  if (error) {
    sessionStorage.setItem(OAUTH_ERROR_KEY, OAUTH_ERRORS[error] || 'Sign-in failed.');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok || !data.user) throw new Error('bad response');

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    window.location.replace('/'); // change if your dashboard isn't at "/"
  } catch {
    sessionStorage.setItem(OAUTH_ERROR_KEY, 'Could not complete Google sign-in.');
  }
}