/**
 * Parent / guardian side — the child's plan in the parent's language,
 * an approvals inbox (consents, scout/college/employer contact requests,
 * documents to sign), upcoming deadlines, and a link into the
 * parent-only financial aid helper.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useI18n } from '@/i18n';
import { getSession } from '@/api/auth';
import {
  getApprovals,
  getDeadlines,
  getPlanActions,
  getStudent,
  respondContactRequest,
  signDocument,
  updateConsents,
} from '@/api';
import type { AppStudent, ApprovalItem, Deadline, PlanAction } from '@/api/types';
import { QueryBoundary } from '@/components/QueryBoundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CalendarDays,
  CheckCircle2,
  FileSignature,
  GraduationCap,
  HandCoins,
  Inbox,
  ShieldCheck,
  ClipboardList,
  Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCENT } from './pathwayAccents';

const A = ACCENT.college;

function fmtDate(iso: string, lang: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ParentPage() {
  const { t, lang } = useI18n();
  const session = getSession();
  const childId = session?.user.child_ids?.[0];

  const [child, setChild] = useState<AppStudent | null>(null);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [actions, setActions] = useState<PlanAction[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [toast, setToast] = useState('');

  const load = useCallback(() => {
    if (!childId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      getStudent(childId),
      getApprovals(childId),
      getPlanActions(childId),
      getDeadlines(childId),
    ])
      .then(([s, a, p, d]) => {
        setChild(s);
        setApprovals(a.data);
        setActions(p.data);
        setDeadlines(d.data);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [childId]);

  useEffect(load, [load]);

  const flash = (key: string) => {
    setToast(t(key));
    setTimeout(() => setToast(''), 3500);
    load();
  };

  const act = (item: ApprovalItem, approve: boolean) => {
    if (!childId) return;
    if (item.kind === 'contact_request') {
      respondContactRequest(childId, item.ref_id, approve ? 'approve' : 'decline')
        .then(() => flash(approve ? 'parentPage.approved' : 'parentPage.declined'))
        .catch(() => {});
    } else if (item.kind === 'consent') {
      updateConsents(childId, { [item.ref_id]: approve })
        .then(() => flash(approve ? 'parentPage.approved' : 'parentPage.declined'))
        .catch(() => {});
    } else {
      signDocument(childId, item.ref_id)
        .then(() => flash('parentPage.signed'))
        .catch(() => {});
    }
  };

  const pending = approvals.filter((a) => a.status === 'pending');
  const done = approvals.filter((a) => a.status !== 'pending');

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className={cn('h-7 w-7', A.text)} />
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{t('parentPage.title')}</h1>
        </div>
        {child && (
          <p className="mt-1 text-sm text-muted-foreground">
            {t('parentPage.subtitle', { name: child.preferred_name || child.first_name })}
          </p>
        )}
      </header>

      {toast && (
        <p className={cn('mb-4 rounded-xl border px-4 py-2 text-sm', A.soft, A.border, A.text)}>{toast}</p>
      )}

      <QueryBoundary loading={loading} error={error} isEmpty={!child} onRetry={load}>
        {child && childId && (
          <>
            {/* Approvals inbox */}
            <section className="rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <Inbox className="h-5 w-5 text-gold-deep" aria-hidden />
                {t('parentPage.inboxTitle')}
                {pending.length > 0 && <Badge variant="destructive">{pending.length}</Badge>}
              </h2>
              {pending.length === 0 && done.length === 0 && (
                <p className="mt-2 text-sm text-muted-foreground">{t('parentPage.inboxEmpty')}</p>
              )}
              {pending.length === 0 && done.length > 0 && (
                <p className="mt-2 text-sm text-muted-foreground">{t('parentPage.allCaughtUp')}</p>
              )}
              <ul className="mt-3 space-y-3">
                {[...pending, ...done].map((a) => (
                  <li key={a.item_id} className="rounded-xl border p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{lang === 'es' ? a.title_es : a.title_en}</p>
                      <Badge
                        variant={a.status === 'pending' ? 'outline' : 'secondary'}
                        className="gap-1"
                      >
                        {a.status !== 'pending' && <CheckCircle2 className="h-3 w-3" />}
                        {t(`parentPage.status.${a.status}`)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">{lang === 'es' ? a.detail_es : a.detail_en}</p>
                    {a.status === 'pending' && (
                      <div className="mt-3 flex gap-2">
                        {a.kind === 'signature' ? (
                          <Button size="sm" className={cn('min-touch rounded-full text-white', A.bg)} onClick={() => act(a, true)}>
                            <FileSignature className="h-4 w-4" /> {t('parentPage.sign')}
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" className={cn('min-touch rounded-full text-white', A.bg)} onClick={() => act(a, true)}>
                              {t('parentPage.approve')}
                            </Button>
                            <Button size="sm" variant="outline" className="min-touch rounded-full" onClick={() => act(a, false)}>
                              {t('parentPage.decline')}
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            {/* Child's plan */}
            <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <ClipboardList className="h-5 w-5 text-gold-deep" aria-hidden />
                {t('parentPage.planTitle')}
              </h2>
              {actions.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">{t('parentPage.planEmpty')}</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {actions.slice(0, 8).map((p) => (
                    <li key={p.action_id} className="flex items-center gap-3 rounded-xl border p-3 text-sm">
                      {p.status === 'done' ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-sports" aria-hidden />
                      ) : (
                        <span className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/40" aria-hidden />
                      )}
                      <span className={cn(p.status === 'done' && 'text-muted-foreground line-through')}>
                        {lang === 'es' ? p.title_es : p.title_en}
                      </span>
                      <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                        {p.due_date && (
                          <>
                            <CalendarDays className="h-3 w-3" aria-hidden />
                            {fmtDate(p.due_date, lang)}
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Deadlines */}
            <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <CalendarDays className="h-5 w-5 text-gold-deep" aria-hidden />
                {t('parentPage.deadlinesTitle')}
              </h2>
              {deadlines.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">{t('parentPage.deadlinesEmpty')}</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {deadlines.slice(0, 6).map((d) => (
                    <li key={d.deadline_id} className="flex items-center justify-between gap-2 rounded-xl border p-3 text-sm">
                      <span>{lang === 'es' ? d.title_es : d.title_en}</span>
                      <Badge variant="outline">{fmtDate(d.date, lang)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Financial aid helper link */}
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Button asChild variant="outline" className="min-touch h-auto rounded-2xl p-4 text-left">
                <Link to="/college">
                  <HandCoins className="h-5 w-5 text-gold-deep" aria-hidden />
                  <span className="ml-2 text-sm font-semibold">{t('parentPage.aidLink')}</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="min-touch h-auto rounded-2xl p-4 text-left">
                <Link to="/college">
                  <GraduationCap className="h-5 w-5 text-college" aria-hidden />
                  <span className="ml-2 text-sm font-semibold">{t('pathways.college')}</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="min-touch h-auto rounded-2xl p-4 text-left">
                <Link to="/sports">
                  <Trophy className="h-5 w-5 text-sports" aria-hidden />
                  <span className="ml-2 text-sm font-semibold">{t('pathways.sports')}</span>
                </Link>
              </Button>
            </div>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
