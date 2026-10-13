import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { useI18n } from '@/i18n';
import { useTheme } from '@/hooks/useTheme';
import { getSession, onAuthChange, setDemoRole, signOut } from '@/api/auth';
import { DEMO_PERSONAS } from '@/api/personas';
import type { DemoRole, Session } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Briefcase,
  GraduationCap,
  House,
  IdCard,
  Languages,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  TrendingUp,
  Trophy,
  UserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLES: DemoRole[] = ['student', 'parent', 'coach', 'partner', 'club_staff', 'admin'];

/** Small FC Brownsville / TXFA wordmark badge. */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <Link to="/" className="flex items-center gap-2.5 min-touch">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold font-display text-sm font-bold text-[#0B0B0B]">
        TX
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block font-display text-sm font-bold tracking-tight">
            {t('app.name')}
          </span>
          <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-gold-deep">
            {t('app.tagline')}
          </span>
        </span>
      )}
    </Link>
  );
}

const NAV = [
  { to: '/', key: 'nav.home', icon: House, end: true },
  { to: '/career', key: 'nav.career', icon: Briefcase },
  { to: '/college', key: 'nav.college', icon: GraduationCap },
  { to: '/sports', key: 'nav.sports', icon: Trophy },
  { to: '/consent', key: 'nav.consent', icon: ShieldCheck },
] as const;

/** Club staff (FC Brownsville) get Talent Insights instead of the student
 *  pathways — their decision-support area (Prompt 6B). */
const CLUB_STAFF_NAV = [
  { to: '/', key: 'nav.home', icon: House, end: true },
  { to: '/talent', key: 'nav.talent', icon: TrendingUp },
  { to: '/staff', key: 'nav.caseload', icon: IdCard },
  { to: '/consent', key: 'nav.consent', icon: ShieldCheck },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(() => getSession());

  useEffect(() => onAuthChange(setSession), []);
  const role: DemoRole = session?.user.role ?? 'student';
  const nav = role === 'club_staff' ? CLUB_STAFF_NAV : NAV;

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="px-5 py-6">
          <BrandMark />
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map(({ to, key, icon: Icon, ...rest }) => (
            <NavLink
              key={to}
              to={to}
              end={'end' in rest}
              className={({ isActive }) =>
                cn(
                  'flex min-touch items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-gold'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                )
              }
            >
              <Icon className="size-5" aria-hidden />
              {t(key)}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border px-5 py-4 text-[11px] leading-relaxed text-sidebar-foreground/60">
          FC Brownsville × Racing de Santander
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur-sm lg:px-6">
          <div className="lg:hidden">
            <BrandMark compact />
          </div>
          <div className="flex-1" />

          {/* Demo role switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="min-touch rounded-full border-gold/50">
                <UserRound className="size-4" aria-hidden />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gold-deep">
                  {t('roles.label')}:
                </span>
                {t(`roles.${role}`)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('roles.label')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ROLES.map((r) => (
                <DropdownMenuItem
                  key={r}
                  className="min-touch"
                  onSelect={() => setDemoRole(r)}
                >
                  {t(`roles.${r}`)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t('personas.label')}</DropdownMenuLabel>
              {DEMO_PERSONAS.map((p) => (
                <DropdownMenuItem
                  key={p.student_id}
                  className="min-touch flex-col items-start gap-0.5"
                  onSelect={() => setDemoRole('student', p.student_id)}
                >
                  <span className="font-medium">{t(`personas.${p.key}`)}</span>
                  <span className="text-xs text-muted-foreground">{t(`personas.${p.key}Desc`)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Language toggle — visible on every screen */}
          <Button
            variant="ghost"
            size="sm"
            className="min-touch rounded-full font-semibold"
            onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
            aria-label={t('app.language')}
          >
            <Languages className="size-4" aria-hidden />
            {t('app.language')}
          </Button>

          {role === 'student' && session?.user.student_id && (
            <Button
              variant="ghost"
              size="icon"
              className="min-touch rounded-full"
              aria-label={t('nav.profile')}
              onClick={() => navigate('/profile')}
            >
              <IdCard className="size-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="min-touch rounded-full"
            onClick={toggle}
            aria-label={theme === 'dark' ? t('app.lightMode') : t('app.darkMode')}
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          {session && (
            <Button
              variant="ghost"
              size="icon"
              className="min-touch rounded-full"
              aria-label={t('nav.signOut')}
              onClick={() => {
                void signOut().then(() => navigate('/login'));
              }}
            >
              <LogOut className="size-4" />
            </Button>
          )}
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 lg:px-8 lg:pb-12">
          {children}
        </main>

        {/* Mobile bottom tabs */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-safe backdrop-blur-sm lg:hidden">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
            {nav.map(({ to, key, icon: Icon, ...rest }) => (
              <NavLink
                key={to}
                to={to}
                end={'end' in rest}
                className={({ isActive }) =>
                  cn(
                    'flex min-touch flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium',
                    isActive ? 'text-gold-deep' : 'text-muted-foreground',
                  )
                }
              >
                <Icon className="size-5" aria-hidden />
                {t(key)}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
