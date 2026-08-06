/**
 * Decodes a JWT token without external libraries and checks if it is expired.
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token || typeof token !== 'string') {
    return true;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return true;
    }

    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(payloadBase64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) {
      return false; // If no exp claim, treat as valid
    }

    // exp is in seconds, convert to milliseconds with a 5-second buffer
    const currentTime = Date.now();
    const expirationTime = payload.exp * 1000;

    return currentTime >= expirationTime - 5000;
  } catch (e) {
    console.error('Failed to parse JWT token expiration:', e);
    return true;
  }
}

/**
 * Wipes all user session credentials from local storage.
 */
export function clearUserSession() {
  localStorage.removeItem('syncstream_token');
  localStorage.removeItem('syncstream_userId');
  localStorage.removeItem('syncstream_username');
  localStorage.removeItem('syncstream_email');
  localStorage.removeItem('syncstream_roomId');
  console.log('[Auth] Cleared user session from local storage');
}

/**
 * Authenticated fetch wrapper that automatically manages token header,
 * validates token expiration prior to sending requests, and handles 401/403 responses.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('syncstream_token');

  if (token) {
    if (isTokenExpired(token)) {
      console.warn('[Auth] Detected expired JWT token (24h limit reached). Clearing session.');
      clearUserSession();
      window.dispatchEvent(new Event('syncstream_session_expired'));
      throw new Error('Your session has expired (24h limit). Please sign in again.');
    }

    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  const response = await fetch(url, options);

  if (response.status === 401) {
    console.warn('[Auth] Received 401 Unauthorized from backend. Invalidating local token session.');
    clearUserSession();
    window.dispatchEvent(new Event('syncstream_session_expired'));
  }

  return response;
}
