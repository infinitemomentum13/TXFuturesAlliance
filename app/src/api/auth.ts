/**
 * Auth adapter — the ONLY auth surface screens may use.
 *
 * Shaped like Supabase Auth (signInWithPassword, signInWithOtp magic link,
 * signInWithOAuth, signOut, getSession, onAuthChange) so the real provider
 * can replace this mock without screen changes. The session token is sent
 * as the Bearer token on every API call.
 *
 * Demo behavior: when the mock API is enabled, signInWithPassword accepts
 * any email/password and issues a token carrying the selected demo role.
 */
import type { DemoRole, LoginResponse, Session } from './types';

const SESSION_KEY = 'txfa.session';
const ROLE_KEY = 'txfa.demoRole';

type Listener = (session: Session | null) => void;
const listeners = new Set<Listener>();

let cached: Session | null | undefined;

function decodeToken(token: string): Session | null {
  try {
    const raw = token.replace(/^demo\./, '');
    // Demo tokens are base64-encoded JSON; a real back end will issue
    // standard JWTs (header.payload.signature) — parse the middle segment.
    const payloadPart = raw.split('.').length === 3 ? raw.split('.')[1] : raw;
    const payload = JSON.parse(atob(payloadPart)) as Session['user'];
    return { access_token: token, expires_at: Date.now() + 3600_000, user: payload };
  } catch {
    return null;
  }
}

function persist(session: Session | null) {
  cached = session;
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((fn) => fn(session));
}

export function getSession(): Session | null {
  if (cached !== undefined) return cached;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    cached = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function onAuthChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Demo role selection (role switcher in the header, labeled "Demo"). */
export function getDemoRole(): DemoRole {
  try {
    return (localStorage.getItem(ROLE_KEY) as DemoRole) || 'student';
  } catch {
    return 'student';
  }
}

export function setDemoRole(role: DemoRole, studentId?: string) {
  try {
    localStorage.setItem(ROLE_KEY, role);
    if (role === 'student' && studentId) localStorage.setItem(PERSONA_KEY, studentId);
  } catch {
    /* ignore */
  }
  const s = getSession();
  if (s) {
    // Re-issue a demo session with the new role (and persona for students),
    // keeping the signed-in email. Then reload home so every screen drops
    // state belonging to the previous role/persona.
    void demoLogin(s.user.email, role, studentId ?? s.user.student_id).then(() => {
      // Stay inside this app. On fcbrownsville.com the app lives at /pathways/,
      // so assigning "/" opens the club homepage and looks like a failed switch.
      const base = import.meta.env.BASE_URL || '/';
      const dir =
        base === './' || base === '.'
          ? window.location.pathname.replace(/[^/]*$/, '') || '/'
          : base.endsWith('/')
            ? base
            : `${base}/`;
      const path = window.location.pathname;
      const onApp =
        path === dir || path === dir.replace(/\/$/, '') || path === `${dir}index.html`;
      const hash = window.location.hash;
      const onHome = hash === '' || hash === '#' || hash === '#/' || hash.startsWith('#/?');
      if (onApp && onHome) window.location.reload();
      else window.location.assign(`${dir}#/`);
    });
  }
}

/* Demo persona (which sample student the Student role is signed in as). */
const PERSONA_KEY = 'txfa.demoPersona';

export function getDemoPersona(): string | undefined {
  try {
    return localStorage.getItem(PERSONA_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

async function demoLogin(email: string, role: DemoRole, studentId?: string): Promise<Session> {
  const res = await fetch(`${(import.meta.env.VITE_API_BASE_URL as string) || '/api/v1'}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'demo', role, student_id: studentId }),
  });
  if (!res.ok) throw new Error('LOGIN_FAILED');
  const json = (await res.json()) as LoginResponse;
  const session = decodeToken(json.access_token);
  if (!session) throw new Error('LOGIN_FAILED');
  persist(session);
  return session;
}

/** Supabase-shaped: email + password. */
export async function signInWithPassword(input: {
  email: string;
  password: string;
  role?: DemoRole;
  student_id?: string;
}): Promise<{ session: Session | null; error: string | null }> {
  try {
    const role = input.role ?? getDemoRole();
    const res = await fetch(`${(import.meta.env.VITE_API_BASE_URL as string) || '/api/v1'}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        role,
        student_id:
          input.student_id ?? (role === 'student' ? getDemoPersona() : undefined),
      }),
    });
    if (!res.ok) return { session: null, error: 'invalid_credentials' };
    const json = (await res.json()) as LoginResponse;
    const session = decodeToken(json.access_token);
    persist(session);
    return { session, error: null };
  } catch {
    return { session: null, error: 'network' };
  }
}

/** Supabase-shaped: email magic link. Mock: immediately "sends" the link. */
export async function signInWithOtp(input: {
  email: string;
}): Promise<{ error: string | null }> {
  // Mock: no real email can be sent. The UI explains the link would arrive.
  void input;
  return { error: null };
}

/** Supabase-shaped: OAuth ("Continue with Google"). Mock only. */
export async function signInWithOAuth(input: {
  provider: 'google';
  role?: DemoRole;
}): Promise<{ error: string | null }> {
  const { error } = await signInWithPassword({
    email: `${input.provider}.demo@example.com`,
    password: 'demo',
    role: input.role ?? getDemoRole(),
  });
  return { error };
}

export async function signOut(): Promise<void> {
  persist(null);
}
