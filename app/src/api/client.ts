/**
 * Typed API client. Every screen gets data ONLY through src/api/.
 * Calls fetch() against VITE_API_BASE_URL (default "/api/v1"), sends the
 * Bearer token from the auth session, and normalizes errors.
 */
import { getSession } from './auth';
import type { ApiError } from './types';

export const API_BASE: string = (import.meta.env.VITE_API_BASE_URL as string) || '/api/v1';

export class ApiRequestError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(status: number, body: ApiError | null, fallback: string) {
    super(body?.message ?? fallback);
    this.status = status;
    this.code = body?.error ?? 'UNKNOWN';
    this.details = body?.details;
  }
}

type Query = Record<string, string | number | boolean | undefined>;

function qs(query?: Query): string {
  if (!query) return '';
  const p = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined) p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

async function request<T>(
  method: string,
  path: string,
  opts: { body?: unknown; query?: Query; formData?: FormData } = {},
): Promise<T> {
  const session = getSession();
  const headers: Record<string, string> = {};
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData; // browser sets multipart boundary
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}${qs(opts.query)}`, { method, headers, body });
  } catch {
    throw new ApiRequestError(0, null, 'NETWORK_UNREACHABLE');
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const json = text ? safeJson(text) : null;
  if (!res.ok) {
    throw new ApiRequestError(res.status, json as ApiError | null, `Request failed (${res.status})`);
  }
  return json as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const apiClient = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  postForm: <T>(path: string, formData: FormData) => request<T>('POST', path, { formData }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
