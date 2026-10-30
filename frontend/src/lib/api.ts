export const API_BASE = 
  process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== "undefined" ? "/api/v1" : (process.env.BACKEND_INTERNAL_URL ? `${process.env.BACKEND_INTERNAL_URL}/api/v1` : "http://127.0.0.1:8000/api/v1"));

const TOKEN_KEY = "prama_auth_token";
const USER_KEY = "prama_auth_user";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser(): any | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(token: string | null, user: any | null = null): void {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
  window.dispatchEvent(new Event("authChanged"));
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const token = getAuthToken();

  const headers: Record<string, string> = {};

  // Only set Content-Type to JSON if not uploading FormData
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Merge any custom headers
  if (options.headers) {
    const customHeaders = options.headers as Record<string, string>;
    Object.assign(headers, customHeaders);
  }

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorBody.detail || `API request failed with status ${res.status}`);
  }
  return res.json();
}

export const ROLE_CREDENTIALS: Record<string, { email: string; name: string }> = {
  maker: { email: "maker@aicte.gov.in", name: "Scrutiny Officer" },
  checker: { email: "checker@aicte.gov.in", name: "Senior Director" },
  institute: { email: "institute1@iit.ac.in", name: "NIT Pune (Inst)" },
  admin: { email: "admin@aicte.gov.in", name: "Bureau Admin" },
};

export async function switchUserPersona(roleKey: "maker" | "checker" | "institute" | "admin"): Promise<any> {
  const creds = ROLE_CREDENTIALS[roleKey];
  if (!creds) return null;
  const res = await fetchApi<{ access_token: string; user: any }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: creds.email, password: "Password@123" })
  });
  setAuthSession(res.access_token, res.user);
  return res.user;
}
