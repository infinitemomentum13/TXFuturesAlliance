import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useI18n } from '@/i18n';
import { signInWithOAuth, signInWithOtp, signInWithPassword } from '@/api/auth';
import { BrandMark } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

/** Only allow "next" values that are paths inside this app. */
function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('://')) return null;
  const allowed = ['/career', '/college', '/sports', '/consent', '/onboarding', '/compass', '/profile', '/admin'];
  return allowed.some((p) => raw === p || raw.startsWith(`${p}/`)) ? raw : null;
}

export default function Login() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fromFcb = params.get('from') === 'fcb';
  const next = useMemo(() => safeNext(params.get('next')), [params]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  const goHome = () => navigate(next ?? '/', { replace: true });

  const doPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: errCode } = await signInWithPassword({ email, password });
    setBusy(false);
    if (errCode) setError(errCode === 'network' ? t('app.errorNetwork') : t('login.invalid'));
    else goHome();
  };

  const doMagic = async () => {
    setBusy(true);
    await signInWithOtp({ email });
    setBusy(false);
    setMagicSent(true);
  };

  const doGoogle = async () => {
    setBusy(true);
    setError(null);
    const { error: errCode } = await signInWithOAuth({ provider: 'google' });
    setBusy(false);
    if (errCode) setError(errCode === 'network' ? t('app.errorNetwork') : t('login.invalid'));
    else goHome();
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-4 lg:px-8">
        <BrandMark />
        <Button variant="ghost" size="sm" className="min-touch rounded-full font-semibold" onClick={() => setLang(lang === 'en' ? 'es' : 'en')}>
          {t('app.language')}
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-16">
        {fromFcb && (
          <div className="mb-6 rounded-2xl border-2 border-gold bg-gold-soft p-5">
            <div className="mb-2 flex items-center gap-3">
              {/* Club crest placeholder */}
              <span className="grid size-12 place-items-center rounded-full border-2 border-gold bg-[#0B0B0B] font-display text-xs font-bold text-gold">
                FCB
              </span>
              <div>
                <p className="font-display text-base font-bold">{t('login.fcbWelcome')}</p>
                <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                  {t('app.photoPlaceholder')}
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed">{t('login.fcbWelcomeBody')}</p>
          </div>
        )}

        <h1 className="font-display text-3xl font-extrabold tracking-tight">{t('login.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('login.subtitle')}</p>

        <form onSubmit={doPassword} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('login.email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="min-touch"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t('login.password')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className="min-touch"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="min-touch w-full rounded-full" disabled={busy}>
            {t('login.signIn')}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground" title={t('login.forgotNote')}>
              {t('login.forgot')}
            </span>
            <button
              type="button"
              onClick={doMagic}
              className="min-touch font-medium text-gold-deep underline-offset-4 hover:underline"
            >
              {t('login.magicLink')}
            </button>
          </div>
          {magicSent && <p className="text-sm text-muted-foreground">{t('login.magicLinkSent')}</p>}
        </form>

        <div className="my-6 flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">·</span>
          <Separator className="flex-1" />
        </div>

        <Button variant="outline" className="min-touch w-full rounded-full" onClick={doGoogle} disabled={busy}>
          {t('login.google')}
        </Button>

        <p className="mt-8 text-center text-sm">
          <span className="text-muted-foreground">{t('login.noAccount')} </span>
          <Link to="/signup-parent" className="font-semibold text-gold-deep underline-offset-4 hover:underline">
            {t('login.parentSignup')}
          </Link>
        </p>
        <p className="mt-4 rounded-xl bg-muted px-4 py-3 text-center text-xs text-muted-foreground">
          {t('login.demoHint')}
        </p>
      </main>
    </div>
  );
}
