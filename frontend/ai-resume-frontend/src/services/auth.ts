const AUTH_EXPIRED_EVENT = "resume-ats:auth-expired";
const AUTH_KEYS = ["access", "refresh", "username", "email"];

export function getActiveAccessToken(): string | null {
  try {
    const token = localStorage.getItem("access");
    if (!token) return null;
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    if (typeof decoded.exp !== "number" || decoded.exp * 1000 <= Date.now()) {
      clearAuthSession();
      return null;
    }
    return token;
  } catch {
    clearAuthSession();
    return null;
  }
}

export function clearAuthSession(): void {
  try {
    AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

export function addAuthExpiredListener(listener: () => void): () => void {
  window.addEventListener(AUTH_EXPIRED_EVENT, listener);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, listener);
}
