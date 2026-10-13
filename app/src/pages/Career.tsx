/**
 * Career pathway — certificate careers for students who need good income
 * fast without a 4-year degree. Three tabs: Explore (filterable catalog),
 * Internships & jobs (partner postings + apply flow + status tracking),
 * For athletes (sport-connected careers).
 *
 * All data comes over HTTP from the mock API; every figure is sample data.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useI18n } from '@/i18n';
import { getSession } from '@/api/auth';
import {
  applyToInternship,
  getAthleticProfiles,
  getInternshipApplications,
  getMyStory,
  getSavedCareers,
  getStudent,
  listCareers,
  listInternships,
  saveCareer,
  unsaveCareer,
  withdrawInternshipApplication,
} from '@/api';
import type {
  AppStudent,
  Career,
  InternshipApplication,
  InternshipPosting,
  SavedCareer,
} from '@/api/types';
import { QueryBoundary } from '@/components/QueryBoundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Building2,
  CalendarDays,
  Filter,
  MapPin,
  Search,
  Sparkles,
  Trophy,
  Wallet,
  X,
} from 'lucide-react';
import { ACCENT } from './pathwayAccents';
import { cn } from '@/lib/utils';

type QuickFilter = 'pay3m' | 'funded' | 'under18' | 'nearRgv' | 'sport';

const SECTOR_KEYS = ['logistics', 'manufacturing', 'aerospace', 'healthcare', 'energy', 'trades', 'technology', 'services', 'sports'];

export function studentAge(dob: string): number {
  const b = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) age -= 1;
  return age;
}

export function fmtDate(iso: string, lang: string): string {
  try {
    return new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString(
      lang === 'es' ? 'es-MX' : 'en-US',
      { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' },
    );
  } catch {
    return iso;
  }
}

export default function CareerPage() {
  const { t } = useI18n();
  const studentId = getSession()?.user.student_id;

  const [student, setStudent] = useState<AppStudent | null>(null);
  const [careers, setCareers] = useState<Career[]>([]);
  const [savedCareers, setSavedCareers] = useState<SavedCareer[]>([]);
  const [postings, setPostings] = useState<InternshipPosting[]>([]);
  const [applications, setApplications] = useState<InternshipApplication[]>([]);
  const [hasAthletic, setHasAthletic] = useState(false);
  const [storyText, setStoryText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const [quick, setQuick] = useState<Set<QuickFilter>>(new Set());
  const [sector, setSector] = useState<string>('');
  const [search, setSearch] = useState('');

  const loadBase = useCallback(() => {
    if (!studentId) return;
    Promise.all([
      getStudent(studentId),
      getSavedCareers(studentId),
      getInternshipApplications(studentId),
      listInternships({ page_size: 50 }),
      getAthleticProfiles(studentId),
      getMyStory(studentId),
    ])
      .then(([stu, saved, apps, posts, athletic, story]) => {
        setStudent(stu);
        setSavedCareers(saved.data);
        setApplications(apps.data);
        setPostings(posts.data);
        setHasAthletic(athletic.data.length > 0);
        setStoryText(story.text ?? '');
      })
      .catch(() => {});
  }, [studentId]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const q: Parameters<typeof listCareers>[0] = { page_size: 100 };
    if (quick.has('pay3m')) q.max_weeks = 10; // first paycheck under ~3 months
    if (quick.has('funded')) q.funded = true;
    if (quick.has('under18')) q.start_under_18 = true;
    if (quick.has('nearRgv')) q.near_rgv = true;
    if (quick.has('sport')) q.sport_friendly = true;
    if (sector) q.rgv_sector = sector;
    if (search.trim()) q.search = search.trim();
    listCareers(q)
      .then((res) => setCareers(res.data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [quick, sector, search]);

  useEffect(loadBase, [loadBase]);
  useEffect(load, [load]);

  const savedIds = useMemo(() => new Map(savedCareers.map((s) => [s.career_id, s.saved_id])), [savedCareers]);

  const toggleSave = async (careerId: string) => {
    if (!studentId) return;
    const existing = savedIds.get(careerId);
    if (existing) {
      await unsaveCareer(studentId, existing);
      setSavedCareers((rows) => rows.filter((r) => r.saved_id !== existing));
    } else {
      const row = await saveCareer(studentId, careerId);
      setSavedCareers((rows) => [...rows, row]);
    }
  };

  const toggleQuick = (k: QuickFilter) =>
    setQuick((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  if (student && student.app_mode === 'explorer') return <ExplorerLite careers={careers} />;

  const appliedPostingIds = new Set(applications.map((a) => a.posting_id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className={cn('font-display text-3xl font-extrabold tracking-tight', ACCENT.career.text)}>
            {t('careerPage.title')}
          </h1>
          <Badge variant="outline" className="border-gold/60 text-gold-deep">
            {t('careerPage.sampleBadge')}
          </Badge>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('careerPage.subtitle')}</p>
      </div>

      <Tabs defaultValue="explore">
        <TabsList className="w-full justify-start sm:w-auto">
          <TabsTrigger value="explore" className="gap-1.5">
            <Briefcase className="size-4" aria-hidden />
            {t('careerPage.tabExplore')}
          </TabsTrigger>
          <TabsTrigger value="jobs" className="gap-1.5">
            <Building2 className="size-4" aria-hidden />
            {t('careerPage.tabJobs')}
            {applications.length > 0 && (
              <span className="ml-1 rounded-full bg-career px-1.5 text-[10px] font-bold text-white">
                {applications.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="sport" className="gap-1.5">
            <Trophy className="size-4" aria-hidden />
            {t('careerPage.tabSport')}
          </TabsTrigger>
        </TabsList>

        {/* ---------------- EXPLORE ---------------- */}
        <TabsContent value="explore" className="mt-5 space-y-4">
          {/* Quick filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="size-4 text-muted-foreground" aria-hidden />
            {(
              [
                ['pay3m', 'careerPage.fPay3m'],
                ['funded', 'careerPage.fFunded'],
                ['under18', 'careerPage.fUnder18'],
                ['nearRgv', 'careerPage.fNearRgv'],
                ['sport', 'careerPage.fSport'],
              ] as Array<[QuickFilter, string]>
            ).map(([key, labelKey]) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleQuick(key)}
                className={cn(
                  'min-touch rounded-full border-2 px-3.5 py-1.5 text-xs font-semibold transition-colors',
                  quick.has(key)
                    ? 'border-career bg-career text-white'
                    : 'border-border bg-card text-foreground hover:border-career/60',
                )}
              >
                {t(labelKey)}
              </button>
            ))}
            <Select value={sector} onValueChange={(v) => setSector(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-9 w-48 rounded-full text-xs">
                <SelectValue placeholder={t('careerPage.sectorAll')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('careerPage.sectorAll')}</SelectItem>
                {SECTOR_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {t(`sectors.${k}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('careerPage.searchPh')}
                className="h-9 w-52 rounded-full pl-9 text-xs"
              />
            </div>
            {(quick.size > 0 || sector || search) && (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-xs"
                onClick={() => {
                  setQuick(new Set());
                  setSector('');
                  setSearch('');
                }}
              >
                <X className="size-3.5" aria-hidden />
                {t('careerPage.clearFilters')}
              </Button>
            )}
          </div>

          <QueryBoundary loading={loading} error={error} onRetry={load}>
            <p className="text-xs text-muted-foreground">
              {t('careerPage.resultsCount', { count: careers.length })}
            </p>
            {careers.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
                {t('careerPage.noResults')}
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {careers.map((c) => (
                  <CareerCard
                    key={c.career_id}
                    career={c}
                    saved={savedIds.has(c.career_id)}
                    onToggleSave={() => void toggleSave(c.career_id)}
                  />
                ))}
              </div>
            )}
          </QueryBoundary>
        </TabsContent>

        {/* ---------------- INTERNSHIPS & JOBS ---------------- */}
        <TabsContent value="jobs" className="mt-5">
          <JobsTab
            postings={postings}
            applications={applications}
            storyText={storyText}
            appliedIds={appliedPostingIds}
            studentId={studentId}
            onChanged={loadBase}
          />
        </TabsContent>

        {/* ---------------- FOR ATHLETES ---------------- */}
        <TabsContent value="sport" className="mt-5">
          <SportTab careers={careers} hasAthletic={hasAthletic} savedIds={savedIds} onToggleSave={toggleSave} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================ CAREER CARD ============================== */

export function CareerCard({
  career: c,
  saved,
  onToggleSave,
}: {
  career: Career;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const { t, lang } = useI18n();
  const title = lang === 'es' ? c.title_es : c.title_en;
  const summary = lang === 'es' ? c.summary_es : c.summary_en;
  return (
    <div className="group relative flex flex-col rounded-2xl border-2 border-border bg-card p-5 transition-colors hover:border-career/60">
      <div className="flex items-start justify-between gap-2">
        <Link to={`/career/${c.career_id}`} className="min-w-0">
          <h3 className="font-display text-lg font-bold leading-snug group-hover:underline">{title}</h3>
        </Link>
        <button
          type="button"
          onClick={onToggleSave}
          aria-label={t(saved ? 'careerPage.saved' : 'careerPage.save')}
          className={cn(
            'rounded-full p-1.5 transition-colors',
            saved ? 'text-career' : 'text-muted-foreground hover:text-career',
          )}
        >
          {saved ? <BookmarkCheck className="size-5" aria-hidden /> : <Bookmark className="size-5" aria-hidden />}
        </button>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{summary}</p>

      {/* Headline number */}
      <div className="mt-3 rounded-xl bg-career-soft px-3 py-2">
        <p className={cn('font-display text-sm font-extrabold', ACCENT.career.text)}>
          {t('careerPage.firstPaycheck', { weeks: c.weeks_to_first_paycheck })}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          {t('careerPage.rgvPay')}: <strong className="text-foreground">${c.starting_pay_rgv_hourly}{t('careerPage.perHour')}</strong>
        </span>
        <span>
          {t('careerPage.txPay')}: ${c.starting_pay_tx_hourly}
          {t('careerPage.perHour')}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="text-[11px]">
          {t('careerPage.weeksUnit', { weeks: c.training_length_weeks })}
        </Badge>
        <Badge variant="secondary" className="text-[11px]">
          ${c.training_cost_usd.toLocaleString('en-US')}
        </Badge>
        {c.funded_options.length > 0 && (
          <Badge className="bg-career text-[11px] text-white">{t('careerPage.fundedTag')}</Badge>
        )}
        <Badge variant="outline" className="text-[11px]">
          {t('careerPage.trainAt', { age: c.min_age_train })}
        </Badge>
        {c.min_age_work > c.min_age_train && (
          <Badge variant="outline" className="border-amber-400 text-[11px] text-amber-700">
            {t('careerPage.workAt', { age: c.min_age_work })}
          </Badge>
        )}
        {c.sport_friendly && (
          <Badge variant="outline" className="border-sports/50 text-[11px] text-sports">
            {t('careerPage.sportOk')}
          </Badge>
        )}
      </div>

      <Link
        to={`/career/${c.career_id}`}
        className={cn(
          'mt-4 inline-flex items-center gap-1 text-sm font-semibold',
          ACCENT.career.text,
        )}
      >
        {t('careerPage.viewPlan')}
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

/* ========================== JOBS TAB ================================== */

function JobsTab({
  postings,
  applications,
  storyText,
  appliedIds,
  studentId,
  onChanged,
}: {
  postings: InternshipPosting[];
  applications: InternshipApplication[];
  storyText: string;
  appliedIds: Set<string>;
  studentId?: string;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [applyFor, setApplyFor] = useState<InternshipPosting | null>(null);

  return (
    <div className="space-y-8">
      {/* My applications */}
      <section>
        <h2 className="font-display text-xl font-bold">{t('careerPage.myApps')}</h2>
        {applications.length === 0 ? (
          <p className="mt-2 rounded-2xl border-2 border-dashed p-6 text-sm text-muted-foreground">
            {t('careerPage.noApps')}
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {applications.map((a) => (
              <ApplicationCard key={a.application_id} app={a} studentId={studentId} onChanged={onChanged} />
            ))}
          </div>
        )}
      </section>

      {/* Open postings */}
      <section>
        <h2 className="font-display text-xl font-bold">{t('careerPage.openPostings')}</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {postings.map((p) => (
            <PostingCard key={p.posting_id} posting={p} applied={appliedIds.has(p.posting_id)} onApply={() => setApplyFor(p)} />
          ))}
        </div>
      </section>

      {/* Apply dialog */}
      <ApplyDialog
        posting={applyFor}
        storyText={storyText}
        studentId={studentId}
        onClose={() => setApplyFor(null)}
        onDone={() => {
          setApplyFor(null);
          onChanged();
        }}
      />
    </div>
  );
}

function payLabel(p: InternshipPosting, t: (k: string, v?: Record<string, string | number>) => string): string {
  if (p.pay_type === 'Hourly' && p.pay_rate != null) return t('careerPage.payHourly', { rate: p.pay_rate });
  if (p.pay_type === 'Stipend' && p.pay_rate != null) return t('careerPage.payStipend', { rate: p.pay_rate });
  if (p.pay_type === 'Credit Only') return t('careerPage.payCredit');
  return t('careerPage.payUnpaid');
}

function PostingCard({
  posting: p,
  applied,
  onApply,
}: {
  posting: InternshipPosting;
  applied: boolean;
  onApply: () => void;
}) {
  const { t, lang } = useI18n();
  return (
    <div className="flex flex-col rounded-2xl border-2 border-border bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold">{p.job_title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {p.company_name} · {p.partner_sector}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 border-gold/60 text-[10px] text-gold-deep">
          {t('careerPage.sampleBadge')}
        </Badge>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1 font-semibold text-foreground">
          <Wallet className="size-3.5 text-career" aria-hidden />
          {payLabel(p, t)}
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden />
          {t('careerPage.weeksHours', { weeks: p.duration_weeks, hours: p.hours_per_week })}
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <MapPin className="size-3.5" aria-hidden />
          {p.location}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="text-[11px]">
          {t('careerPage.deadline', { date: fmtDate(p.application_deadline, lang) })}
        </Badge>
        <Badge variant="secondary" className="text-[11px]">
          {t('careerPage.positionsLeft', { count: p.positions_available - p.positions_filled })}
        </Badge>
        {p.required_grade_levels && (
          <Badge variant="outline" className="text-[11px]">
            {t('careerPage.gradeReq', { grades: p.required_grade_levels.join(', ') })}
          </Badge>
        )}
        {p.minimum_gpa != null && (
          <Badge variant="outline" className="text-[11px]">
            {t('careerPage.gpaReq', { gpa: p.minimum_gpa })}
          </Badge>
        )}
        {p.potential_for_hire && <Badge className="bg-career text-[11px] text-white">{t('careerPage.toHire')}</Badge>}
        {p.remote_option && <Badge variant="outline" className="text-[11px]">{t('careerPage.remoteOk')}</Badge>}
        {p.sport_schedule_friendly && (
          <Badge variant="outline" className="border-sports/50 text-[11px] text-sports">
            {t('careerPage.sportFriendlyPosting')}
          </Badge>
        )}
      </div>
      <div className="mt-4">
        {applied ? (
          <Badge className="bg-career text-white">{t('careerPage.applied')}</Badge>
        ) : (
          <Button size="sm" className="rounded-full bg-career text-white hover:bg-career/90" onClick={onApply}>
            {t('careerPage.applyNow')}
          </Button>
        )}
      </div>
    </div>
  );
}

function ApplicationCard({
  app: a,
  studentId,
  onChanged,
}: {
  app: InternshipApplication;
  studentId?: string;
  onChanged: () => void;
}) {
  const { t, lang } = useI18n();
  const [busy, setBusy] = useState(false);
  const withdraw = async () => {
    if (!studentId) return;
    setBusy(true);
    try {
      await withdrawInternshipApplication(studentId, a.application_id);
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const open = !['withdrawn', 'rejected', 'declined', 'accepted'].includes(a.status);
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold">{a.posting?.job_title}</h3>
          <p className="text-sm text-muted-foreground">{a.posting?.company_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn('text-[11px]', a.status === 'withdrawn' ? 'bg-muted text-muted-foreground' : 'bg-career text-white')}>
            {t(`appStatus.${a.status}`)}
          </Badge>
          {open && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={busy} onClick={() => void withdraw()}>
              {t('careerPage.withdraw')}
            </Button>
          )}
        </div>
      </div>
      {/* status timeline */}
      <ol className="mt-3 space-y-1.5 border-l-2 border-career/40 pl-3">
        {a.status_history.map((h, i) => (
          <li key={i} className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{t(`appStatus.${h.status}`)}</span>
            {' — '}
            {fmtDate(h.timestamp, lang)}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ApplyDialog({
  posting,
  storyText,
  studentId,
  onClose,
  onDone,
}: {
  posting: InternshipPosting | null;
  storyText: string;
  studentId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [why, setWhy] = useState('');
  const [avail, setAvail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    setWhy('');
    setAvail('');
    setDone(false);
    setErr('');
  }, [posting?.posting_id]);

  const submit = async () => {
    if (!posting || !studentId) return;
    setBusy(true);
    setErr('');
    try {
      await applyToInternship(studentId, {
        posting_id: posting.posting_id,
        application_responses: { why_interested: why, availability: avail },
      });
      setDone(true);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setErr(code === 'ALREADY_APPLIED' ? t('careerPage.dupApplied') : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!posting} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('careerPage.applyTitle', { title: posting?.job_title ?? '' })}</DialogTitle>
          <DialogDescription>{posting?.company_name}</DialogDescription>
        </DialogHeader>
        {done ? (
          <div className="space-y-4">
            <p className="rounded-xl bg-career-soft p-4 text-sm font-medium">{t('careerPage.appSubmitted')}</p>
            <DialogFooter>
              <Button onClick={onDone} className="rounded-full">{t('app.close')}</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-semibold">{t('careerPage.applyWhy')}</label>
                {storyText && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-gold-deep hover:underline"
                    onClick={() => setWhy(storyText)}
                  >
                    <Sparkles className="size-3" aria-hidden />
                    {t('careerPage.useMyStory')}
                  </button>
                )}
              </div>
              <Textarea value={why} onChange={(e) => setWhy(e.target.value)} placeholder={t('careerPage.applyWhyPh')} rows={3} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">{t('careerPage.applyAvail')}</label>
              <Input value={avail} onChange={(e) => setAvail(e.target.value)} placeholder={t('careerPage.applyAvailPh')} />
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={onClose} className="rounded-full">
                {t('app.cancel')}
              </Button>
              <Button onClick={() => void submit()} disabled={busy || !why.trim()} className="rounded-full bg-career text-white hover:bg-career/90">
                {t('careerPage.submitApp')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ========================== SPORT TAB ================================= */

function SportTab({
  careers,
  hasAthletic,
  savedIds,
  onToggleSave,
}: {
  careers: Career[];
  hasAthletic: boolean;
  savedIds: Map<string, string>;
  onToggleSave: (careerId: string) => void;
}) {
  const { t, lang } = useI18n();
  const sportCareers = careers.filter((c) => c.sport_connection_en || c.sector === 'sports');
  if (!hasAthletic) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-sports/50 bg-sports-soft/40 p-8 text-center">
        <Trophy className="mx-auto size-8 text-sports" aria-hidden />
        <p className="mt-3 font-display text-lg font-bold">{t('careerPage.sportTitle')}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{t('careerPage.sportEmpty')}</p>
        <Link to="/profile">
          <Button className="mt-4 rounded-full bg-sports text-white hover:bg-sports/90">{t('dashboard.viewProfile')}</Button>
        </Link>
      </div>
    );
  }
  return (
    <div>
      <h2 className="font-display text-xl font-bold">{t('careerPage.sportTitle')}</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('careerPage.sportSubtitle')}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sportCareers.map((c) => (
          <div key={c.career_id} className="flex flex-col">
            <CareerCard career={c} saved={savedIds.has(c.career_id)} onToggleSave={() => onToggleSave(c.career_id)} />
            {(lang === 'es' ? c.sport_connection_es : c.sport_connection_en) && (
              <p className="mt-2 rounded-xl bg-sports-soft px-3 py-2 text-xs text-foreground">
                <strong>{t('careerPage.whyForYou')}:</strong>{' '}
                {lang === 'es' ? c.sport_connection_es : c.sport_connection_en}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ======================= EXPLORER LITE ================================ */

function ExplorerLite({ careers }: { careers: Career[] }) {
  const { t, lang } = useI18n();
  const picks = careers.filter((c) => ['car-sample-001', 'car-sample-002', 'car-sample-007', 'car-sample-010'].includes(c.career_id));
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t('explorer.workTitle')}</h1>
      <p className="rounded-2xl border-2 border-gold/50 bg-gold-soft/50 p-4 text-sm">{t('careerPage.explorerNote')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {picks.map((c) => (
          <div key={c.career_id} className="rounded-2xl border-2 border-career/40 bg-card p-5">
            <h3 className="font-display text-base font-bold">{lang === 'es' ? c.title_es : c.title_en}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{lang === 'es' ? c.summary_es : c.summary_en}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
