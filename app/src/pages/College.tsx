/**
 * College & University pathway — school explorer (US / Mexico / Spain /
 * other), scholarship finder with plain-language matching, application
 * tracker, essay helper, "Play in college" lane and the parent-only
 * financial aid helper.
 *
 * All data comes over HTTP from the mock API; every school, scholarship
 * and figure is sample data ("Sample – to verify"). Grades carry a
 * provenance label (self-reported / report card / school import) so
 * students always know how confident a match is.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useI18n } from '@/i18n';
import { getSession } from '@/api/auth';
import {
  createEssayDraft,
  generateMatches,
  getAcademicRecords,
  getAthleticProfiles,
  getCollegeFits,
  getCompass,
  getEssayDrafts,
  getMyStory,
  getSavedColleges,
  getScholarshipApplications,
  getScholarshipMatches,
  getScholarshipOutcomes,
  getStudent,
  listColleges,
  markRecommendationReceived,
  recordApplicationOutcome,
  requestRecommendation,
  saveCollege,
  startApplication,
  submitAidHelper,
  submitApplication,
  unsaveCollege,
  updateApplication,
  updateEssayDraft,
  updateMatch,
} from '@/api';
import type {
  AcademicRecord,
  AppStudent,
  College,
  CollegeFitResult,
  EssayTemplate,
  GradeSource,
  PathwayCompass,
  SavedCollege,
  ScholarshipApplication,
  ScholarshipMatch,
  ScholarshipOutcome,
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
  BookOpen,
  CheckCircle2,
  Circle,
  FileText,
  Globe2,
  GraduationCap,
  Landmark,
  RefreshCw,
  Sparkles,
  Trophy,
  Wallet,
  X,
} from 'lucide-react';
import { ACCENT } from './pathwayAccents';
import { fmtDate } from './Career';
import { cn } from '@/lib/utils';

const A = ACCENT.college;

function fmtMoney(n?: number | null): string {
  if (n === null || n === undefined) return '—';
  return `$${n.toLocaleString('en-US')}`;
}

const FIT_STYLE: Record<string, string> = {
  strong: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  good: 'bg-gold-soft text-gold-deep border-gold/40',
  explore: 'bg-muted text-muted-foreground border-border',
};

const SOURCE_STYLE: Record<string, string> = {
  self_reported: 'bg-amber-100 text-amber-800 border-amber-300',
  report_card: 'bg-sky-100 text-sky-800 border-sky-300',
  school_import: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  none: 'bg-muted text-muted-foreground border-border',
};

/** Kanban buckets for the tracker. */
type BoardCol = 'saved' | 'preparing' | 'submitted' | 'decision' | 'awarded' | 'not_awarded';
const BOARD_ORDER: BoardCol[] = ['saved', 'preparing', 'submitted', 'decision', 'awarded', 'not_awarded'];

function appColumn(a: ScholarshipApplication): BoardCol {
  switch (a.status) {
    case 'in_progress':
      return 'preparing';
    case 'submitted':
      return 'submitted';
    case 'under_review':
    case 'finalist':
    case 'interview_scheduled':
    case 'waitlisted':
      return 'decision';
    case 'awarded':
      return 'awarded';
    case 'denied':
      return 'not_awarded';
    default:
      return 'preparing';
  }
}

/* =============================== page ================================== */

export default function CollegePage() {
  const { t, lang } = useI18n();
  const session = getSession();
  const role = session?.user.role;
  const isParent = role === 'parent';
  const studentId = isParent ? session?.user.child_ids?.[0] : session?.user.student_id;

  const [student, setStudent] = useState<AppStudent | null>(null);
  const [colleges, setColleges] = useState<College[]>([]);
  const [fits, setFits] = useState<CollegeFitResult[]>([]);
  const [savedColleges, setSavedColleges] = useState<SavedCollege[]>([]);
  const [matches, setMatches] = useState<ScholarshipMatch[]>([]);
  const [allMatches, setAllMatches] = useState<ScholarshipMatch[]>([]); // incl. low scores, for unlock hints
  const [applications, setApplications] = useState<ScholarshipApplication[]>([]);
  const [outcomes, setOutcomes] = useState<ScholarshipOutcome[]>([]);
  const [records, setRecords] = useState<AcademicRecord[]>([]);
  const [compass, setCompass] = useState<PathwayCompass | null>(null);
  const [hasAthletic, setHasAthletic] = useState(false);
  const [storyText, setStoryText] = useState('');
  const [essays, setEssays] = useState<EssayTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      getStudent(studentId),
      listColleges({ page_size: 100 }),
      getCollegeFits(studentId),
      getSavedColleges(studentId),
      getScholarshipMatches(studentId),
      getScholarshipMatches(studentId, { min_score: 0 }),
      getScholarshipApplications(studentId),
      getScholarshipOutcomes(studentId),
      getAcademicRecords(studentId),
      getCompass(studentId),
      getAthleticProfiles(studentId),
      getMyStory(studentId),
      getEssayDrafts(studentId),
    ])
      .then(([stu, cols, fitRes, saved, m, mAll, apps, outs, recs, comp, athletic, story, drafts]) => {
        setStudent(stu);
        setColleges(cols.data);
        setFits(fitRes.data);
        setSavedColleges(saved.data);
        setMatches(m.data.filter((x) => !x.dismissed));
        setAllMatches(mAll.data.filter((x) => !x.dismissed));
        setApplications(apps.data);
        setOutcomes(outs.data);
        setRecords(recs.data ?? []);
        setCompass(comp);
        setHasAthletic(athletic.data.length > 0);
        setStoryText(story.text ?? '');
        setEssays(drafts.data);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [studentId]);

  useEffect(load, [load]);

  const fitById = useMemo(() => new Map(fits.map((f) => [f.college_id, f])), [fits]);
  const gradesSource: GradeSource | 'none' =
    fits[0]?.grades_source ?? matches[0]?.grades_source ?? 'none';
  const gpa = useMemo(() => {
    const withGpa = records.filter((r) => r.gpa_cumulative !== null && r.gpa_cumulative !== undefined);
    return withGpa.length ? withGpa[withGpa.length - 1].gpa_cumulative ?? null : null;
  }, [records]);

  const refreshMatches = () => {
    if (!studentId || refreshing) return;
    setRefreshing(true);
    generateMatches(studentId, true)
      .then(() => Promise.all([getScholarshipMatches(studentId), getCollegeFits(studentId)]))
      .then(([m, f]) => {
        setMatches(m.data.filter((x) => !x.dismissed));
        setFits(f.data);
        setToast(t('collegePage.matchesRefreshed'));
        setTimeout(() => setToast(''), 3000);
      })
      .catch(() => {})
      .finally(() => setRefreshing(false));
  };

  if (isParent) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <AidTab studentId={studentId} />
      </div>
    );
  }

  if (student && student.app_mode === 'explorer') {
    return <ExplorerLite colleges={colleges} />;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <GraduationCap className={cn('h-7 w-7', A.text)} />
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            {t('collegePage.title')}
          </h1>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('collegePage.subtitle')}</p>
      </header>

      {toast && (
        <p className={cn('mb-4 rounded-xl border px-4 py-2 text-sm', A.soft, A.border, A.text)}>
          {toast}
        </p>
      )}

      <Tabs defaultValue="schools">
        <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="schools">{t('collegePage.tabSchools')}</TabsTrigger>
          <TabsTrigger value="scholarships">{t('collegePage.tabScholarships')}</TabsTrigger>
          <TabsTrigger value="tracker">{t('collegePage.tabTracker')}</TabsTrigger>
          <TabsTrigger value="essay">{t('collegePage.tabEssay')}</TabsTrigger>
          <TabsTrigger value="play">{t('collegePage.tabPlay')}</TabsTrigger>
          <TabsTrigger value="aid">{t('collegePage.tabAid')}</TabsTrigger>
        </TabsList>

        <QueryBoundary loading={loading} error={error} onRetry={load}>
          <TabsContent value="schools">
            <SchoolsTab
              studentId={studentId}
              lang={lang}
              colleges={colleges}
              fitById={fitById}
              savedColleges={savedColleges}
              setSavedColleges={setSavedColleges}
              gradesSource={gradesSource}
              gpa={gpa}
              refreshing={refreshing}
              onRefresh={refreshMatches}
            />
          </TabsContent>
          <TabsContent value="scholarships">
            <ScholarshipsTab
              studentId={studentId}
              lang={lang}
              matches={matches}
              setMatches={setMatches}
              applications={applications}
              setApplications={setApplications}
              hasAthletic={hasAthletic}
              gradesSource={gradesSource}
              allMatches={allMatches}
            />
          </TabsContent>
          <TabsContent value="tracker">
            <TrackerTab
              studentId={studentId}
              lang={lang}
              applications={applications}
              setApplications={setApplications}
              matches={matches}
              outcomes={outcomes}
              setOutcomes={setOutcomes}
            />
          </TabsContent>
          <TabsContent value="essay">
            <EssayTab
              studentId={studentId}
              essays={essays}
              setEssays={setEssays}
              storyText={storyText}
            />
          </TabsContent>
          <TabsContent value="play">
            <PlayTab
              colleges={colleges}
              fitById={fitById}
              hasAthletic={hasAthletic}
              compass={compass}
            />
          </TabsContent>
          <TabsContent value="aid">
            <AidGate />
          </TabsContent>
        </QueryBoundary>
      </Tabs>
    </div>
  );
}

/* ------------------------- grades confidence panel --------------------- */

function GradesPanel({
  gradesSource,
  gpa,
  refreshing,
  onRefresh,
}: {
  gradesSource: GradeSource | 'none';
  gpa: number | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { t } = useI18n();
  const sources: { key: GradeSource; labelKey: string; descKey: string }[] = [
    { key: 'self_reported', labelKey: 'gradeSources.self_reported', descKey: 'collegePage.sourceSelf' },
    { key: 'report_card', labelKey: 'gradeSources.report_card', descKey: 'collegePage.sourceCard' },
    { key: 'school_import', labelKey: 'gradeSources.school_import', descKey: 'collegePage.sourceImport' },
  ];
  return (
    <section className="mb-6 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">{t('collegePage.gradesTitle')}</h2>
          <p className="text-xs text-muted-foreground">{t('collegePage.gradesNote')}</p>
        </div>
        <div className="flex items-center gap-3">
          {gpa !== null ? (
            <Badge variant="outline" className="text-sm">
              {t('collegePage.gpaLabel')}: {gpa.toFixed(2)}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
              {t('collegePage.noGrades')}
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={cn('mr-1 h-4 w-4', refreshing && 'animate-spin')} />
            {t('collegePage.refreshMatches')}
          </Button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {sources.map((s) => {
          const active = gradesSource === s.key;
          return (
            <div
              key={s.key}
              className={cn(
                'rounded-xl border p-3 text-sm',
                active ? cn(A.border, A.soft) : 'opacity-70',
              )}
            >
              <div className="flex items-center gap-2">
                {active ? (
                  <CheckCircle2 className={cn('h-4 w-4', A.text)} />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-semibold">{t(s.labelKey)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t(s.descKey)}</p>
              {s.key === 'school_import' && (
                <div className="mt-2 rounded-lg border border-dashed bg-muted/50 p-2">
                  <p className="text-xs font-semibold">{t('collegePage.importSoon')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t('collegePage.importSoonNote')}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Small confidence pill shown on every match / fit. */
function SourcePill({ source }: { source: GradeSource | 'none' }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        SOURCE_STYLE[source],
      )}
    >
      {source === 'none'
        ? t('collegePage.matchNoGrades')
        : t('collegePage.matchConfidence', { source: t(`gradeSources.${source}`) })}
    </span>
  );
}

/* ------------------------------ schools tab ---------------------------- */

function SchoolsTab({
  studentId,
  lang,
  colleges,
  fitById,
  savedColleges,
  setSavedColleges,
  gradesSource,
  gpa,
  refreshing,
  onRefresh,
}: {
  studentId?: string;
  lang: string;
  colleges: College[];
  fitById: Map<string, CollegeFitResult>;
  savedColleges: SavedCollege[];
  setSavedColleges: (s: SavedCollege[]) => void;
  gradesSource: GradeSource | 'none';
  gpa: number | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { t } = useI18n();
  const [country, setCountry] = useState('');
  const [soccerOnly, setSoccerOnly] = useState(false);
  const [rgvOnly, setRgvOnly] = useState(false);
  const savedIds = useMemo(() => new Map(savedColleges.map((s) => [s.college_id, s.saved_id])), [savedColleges]);

  const countries = useMemo(
    () => [...new Set(colleges.map((c) => c.country))].sort(),
    [colleges],
  );
  const rows = colleges.filter(
    (c) =>
      (!country || c.country === country) &&
      (!soccerOnly || c.soccer_program !== 'none') &&
      (!rgvOnly || c.in_rgv),
  );

  const toggleSave = (c: College) => {
    if (!studentId) return;
    const savedId = savedIds.get(c.college_id);
    if (savedId) {
      unsaveCollege(studentId, savedId)
        .then(() => setSavedColleges(savedColleges.filter((s) => s.saved_id !== savedId)))
        .catch(() => {});
    } else {
      saveCollege(studentId, c.college_id)
        .then((s) => setSavedColleges([...savedColleges, s]))
        .catch(() => {});
    }
  };

  return (
    <div>
      <GradesPanel gradesSource={gradesSource} gpa={gpa} refreshing={refreshing} onRefresh={onRefresh} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={country || 'all'} onValueChange={(v) => setCountry(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t('collegePage.filterCountry')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('collegePage.filterAll')}</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant={soccerOnly ? 'default' : 'outline'}
          onClick={() => setSoccerOnly(!soccerOnly)}
        >
          <Trophy className="mr-1 h-4 w-4" />
          {t('collegePage.filterSoccer')}
        </Button>
        <Button size="sm" variant={rgvOnly ? 'default' : 'outline'} onClick={() => setRgvOnly(!rgvOnly)}>
          {t('collegePage.filterRgv')}
        </Button>
        <Badge variant="outline" className="ml-auto border-gold/40 bg-gold-soft/50 text-gold-deep">
          Sample – to verify
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((c) => {
          const fit = fitById.get(c.college_id);
          const why = lang === 'es' ? fit?.why_es : fit?.why_en;
          const missing = lang === 'es' ? fit?.missing_es : fit?.missing_en;
          return (
            <article key={c.college_id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold leading-tight">{c.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {c.city}, {c.state_or_region} · {c.country}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {fit && (
                    <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', FIT_STYLE[fit.fit])}>
                      {t(`fitLabels.${fit.fit}`)}
                    </span>
                  )}
                  {c.racing_partner && (
                    <Badge variant="outline" className="border-career/40 bg-career-soft text-career">
                      {t('collegePage.racingBadge')}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">{t('collegePage.costYear')}</span>
                  <p className="font-semibold">{fmtMoney(c.cost_per_year_usd)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">{t('collegePage.typicalAid')}</span>
                  <p className="font-semibold">{fmtMoney(c.typical_aid_usd)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">{t('collegePage.language')}</span>
                  <p className="font-semibold">{c.language_of_instruction ?? '—'}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">{t('collegePage.minGpa')}</span>
                  <p className="font-semibold">{c.min_gpa ?? '—'}</p>
                </div>
              </div>

              {(lang === 'es' ? c.admissions_notes_es : c.admissions_notes_en) && (
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="font-semibold">{t('collegePage.admissions')}: </span>
                  {lang === 'es' ? c.admissions_notes_es : c.admissions_notes_en}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {c.soccer_program !== 'none' ? (
                  <>
                    <Badge variant="outline" className="border-sports/40 bg-sports-soft text-sports">
                      <Trophy className="mr-1 h-3 w-3" />
                      {t('collegePage.hasSport')}
                      {c.soccer_level ? ` · ${t('collegePage.soccerLevel')}: ${c.soccer_level}` : ''}
                    </Badge>
                    <Badge variant="outline">
                      {c.soccer_scholarships
                        ? t('collegePage.athleticMoney')
                        : t('collegePage.noAthleticMoney')}
                    </Badge>
                  </>
                ) : null}
              </div>

              {fit && (why?.length || missing?.length) ? (
                <div className="mt-3 rounded-xl bg-muted/40 p-3 text-xs">
                  {!!why?.length && (
                    <div>
                      <p className="font-semibold">{t('collegePage.whyFit')}</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                        {why.slice(0, 3).map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {!!missing?.length && (
                    <div className="mt-2">
                      <p className="font-semibold">{t('collegePage.whatsMissing')}</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                        {missing.slice(0, 2).map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-2">
                    <SourcePill source={fit.grades_source} />
                  </div>
                </div>
              ) : null}

              <div className="mt-3 flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => toggleSave(c)}>
                  {savedIds.has(c.college_id) ? (
                    <>
                      <BookmarkCheck className={cn('mr-1 h-4 w-4', A.text)} />
                      {t('collegePage.bookmarked')}
                    </>
                  ) : (
                    <>
                      <Bookmark className="mr-1 h-4 w-4" />
                      {t('collegePage.bookmark')}
                    </>
                  )}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------- scholarships tab -------------------------- */

function ScholarshipsTab({
  studentId,
  lang,
  matches,
  setMatches,
  applications,
  setApplications,
  hasAthletic,
  gradesSource,
  allMatches,
}: {
  studentId?: string;
  lang: string;
  matches: ScholarshipMatch[];
  setMatches: (m: ScholarshipMatch[]) => void;
  applications: ScholarshipApplication[];
  setApplications: (a: ScholarshipApplication[]) => void;
  hasAthletic: boolean;
  gradesSource: GradeSource | 'none';
  allMatches: ScholarshipMatch[];
}) {
  const { t } = useI18n();
  const [category, setCategory] = useState('');
  const [athleticOnly, setAthleticOnly] = useState(false);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => m.scholarship?.categories?.forEach((c) => set.add(c)));
    return [...set].sort();
  }, [matches]);

  const appliedIds = useMemo(
    () => new Set(applications.map((a) => a.scholarship_id)),
    [applications],
  );
  // "Add your SAT score to unlock N more" — count from ALL matches,
  // including those below the visible score threshold.
  const satUnlockCount = allMatches.filter((m) =>
    (m.missing_en ?? []).some((x) => x.toLowerCase().includes('sat')),
  ).length;
  const potential = useMemo(
    () =>
      matches
        .filter((m) => !appliedIds.has(m.scholarship_id))
        .reduce((sum, m) => sum + (m.scholarship?.typical_award_amount ?? 0), 0),
    [matches, appliedIds],
  );

  const rows = matches
    .filter((m) => {
      const s = m.scholarship;
      if (!s) return false;
      if (category && !(s.categories ?? []).includes(category)) return false;
      if (athleticOnly && !(s.categories ?? []).includes('Athletic')) return false;
      if (bookmarkedOnly && !m.bookmarked) return false;
      return true;
    })
    .sort((a, b) => b.match_score - a.match_score);

  const toggleBookmark = (m: ScholarshipMatch) => {
    if (!studentId) return;
    const next = !m.bookmarked;
    updateMatch(studentId, m.match_id, { bookmarked: next })
      .then(() =>
        setMatches(matches.map((x) => (x.match_id === m.match_id ? { ...x, bookmarked: next } : x))),
      )
      .catch(() => {});
  };

  const dismiss = (m: ScholarshipMatch) => {
    if (!studentId) return;
    updateMatch(studentId, m.match_id, { dismissed: true })
      .then(() => setMatches(matches.filter((x) => x.match_id !== m.match_id)))
      .catch(() => {});
  };

  const startApp = (m: ScholarshipMatch) => {
    if (!studentId) return;
    startApplication(studentId, m.scholarship_id, m.match_id)
      .then((a) => setApplications([...applications, a]))
      .catch(() => {});
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">{t('collegePage.scholarshipsTitle')}</h2>
        <div className="flex items-center gap-2">
          <Badge className={cn(A.bg, 'text-white')}>
            {t('collegePage.potentialValue', { amount: potential.toLocaleString('en-US') })}
          </Badge>
          <SourcePill source={gradesSource} />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={category || 'all'} onValueChange={(v) => setCategory(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder={t('collegePage.filterCategory')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('collegePage.catAll')}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasAthletic && (
          <Button
            size="sm"
            variant={athleticOnly ? 'default' : 'outline'}
            onClick={() => setAthleticOnly(!athleticOnly)}
          >
            <Trophy className="mr-1 h-4 w-4" />
            {t('collegePage.catAthletic')}
          </Button>
        )}
        <Button
          size="sm"
          variant={bookmarkedOnly ? 'default' : 'outline'}
          onClick={() => setBookmarkedOnly(!bookmarkedOnly)}
        >
          <BookmarkCheck className="mr-1 h-4 w-4" />
          {t('collegePage.onlyBookmarked')}
        </Button>
        <Badge variant="outline" className="ml-auto border-gold/40 bg-gold-soft/50 text-gold-deep">
          Sample – to verify
        </Badge>
      </div>

      {satUnlockCount > 0 && (
        <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {t('collegePage.unlockMore', { count: satUnlockCount })}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((m) => {
          const s = m.scholarship!;
          const athletic = (s.categories ?? []).includes('Athletic');
          const why = lang === 'es' ? m.why_match_es : m.why_match_en;
          const missing = lang === 'es' ? m.missing_es : m.missing_en;
          const applied = appliedIds.has(s.scholarship_id);
          return (
            <article key={m.match_id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold leading-tight">{s.name}</h3>
                  <p className="text-xs text-muted-foreground">{s.organization}</p>
                </div>
                <Badge className={cn(A.soft, A.text, 'border', A.border)}>
                  {t('collegePage.matchScore', { score: m.match_score })}
                </Badge>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                {athletic && (
                  <Badge variant="outline" className="border-sports/40 bg-sports-soft text-sports">
                    <Trophy className="mr-1 h-3 w-3" />
                    {t('collegePage.athleticBadge')}
                  </Badge>
                )}
                {(s.categories ?? []).map((c) => (
                  <Badge key={c} variant="outline">
                    {c}
                  </Badge>
                ))}
                {s.renewable && s.max_years_renewable ? (
                  <Badge variant="outline">
                    {t('collegePage.renewableTag', { years: s.max_years_renewable })}
                  </Badge>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">{t('collegePage.amount')}</span>
                  <p className="font-semibold">
                    {s.award_amount_min === s.award_amount_max
                      ? fmtMoney(s.award_amount_max)
                      : `${fmtMoney(s.award_amount_min)}–${fmtMoney(s.award_amount_max)}`}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">{t('collegePage.deadlineIs')}</span>
                  <p className="font-semibold">{fmtDate(s.application_deadline, lang)}</p>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {s.essay_required && <span>✍ {t('collegePage.essayReq')}</span>}
                {!!s.recommendations_required && (
                  <span>✉ {t('collegePage.recsReq', { count: s.recommendations_required })}</span>
                )}
                {s.fafsa_required && <span>ⓘ {t('collegePage.fafsaReq')}</span>}
              </div>

              {!!why?.length && (
                <div className="mt-3 text-xs">
                  <p className="font-semibold">{t('collegePage.whyYouMatch')}</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                    {why.slice(0, 3).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!!missing?.length && (
                <div className="mt-2 text-xs">
                  <p className="font-semibold">{t('collegePage.whatsMissingShort')}</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                    {missing.slice(0, 2).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-2">
                <SourcePill source={m.grades_source ?? gradesSource} />
              </div>

              <div className="mt-3 flex flex-wrap justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => dismiss(m)}>
                  <X className="mr-1 h-4 w-4" />
                  {t('collegePage.dismiss')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleBookmark(m)}>
                  {m.bookmarked ? (
                    <>
                      <BookmarkCheck className={cn('mr-1 h-4 w-4', A.text)} />
                      {t('collegePage.bookmarked')}
                    </>
                  ) : (
                    <>
                      <Bookmark className="mr-1 h-4 w-4" />
                      {t('collegePage.bookmark')}
                    </>
                  )}
                </Button>
                {applied ? (
                  <Badge className={cn(A.soft, A.text, 'border', A.border, 'px-3 py-2')}>
                    {t('collegePage.appStarted')}
                  </Badge>
                ) : (
                  <Button size="sm" onClick={() => startApp(m)}>
                    {t('collegePage.startApp')}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ tracker tab ---------------------------- */

interface RecLetters {
  requested: number;
  received: number;
  names?: string[];
}

function recLettersOf(a: ScholarshipApplication): RecLetters {
  const raw = a.materials_checklist?.recommendation_letters as RecLetters | undefined;
  return raw ?? { requested: 0, received: 0, names: [] };
}

function TrackerTab({
  studentId,
  lang,
  applications,
  setApplications,
  matches,
  outcomes,
  setOutcomes,
}: {
  studentId?: string;
  lang: string;
  applications: ScholarshipApplication[];
  setApplications: (a: ScholarshipApplication[]) => void;
  matches: ScholarshipMatch[];
  outcomes: ScholarshipOutcome[];
  setOutcomes: (o: ScholarshipOutcome[]) => void;
}) {
  const { t } = useI18n();
  const [recDialogFor, setRecDialogFor] = useState<ScholarshipApplication | null>(null);
  const [recName, setRecName] = useState('');
  const [decisionFor, setDecisionFor] = useState<ScholarshipApplication | null>(null);
  const [awardAmount, setAwardAmount] = useState('');
  const [note, setNote] = useState('');

  const appliedIds = useMemo(
    () => new Set(applications.map((a) => a.scholarship_id)),
    [applications],
  );
  const savedMatches = matches.filter((m) => m.bookmarked && !appliedIds.has(m.scholarship_id));

  const replaceApp = (updated: ScholarshipApplication) =>
    setApplications(applications.map((a) => (a.application_id === updated.application_id ? updated : a)));

  const toggleDoc = (a: ScholarshipApplication, key: 'essay' | 'transcript') => {
    if (!studentId) return;
    const checklist = { ...(a.materials_checklist ?? {}) };
    checklist[key] = !checklist[key];
    updateApplication(studentId, a.application_id, { materials_checklist: checklist })
      .then(replaceApp)
      .catch(() => {});
  };

  const submit = (a: ScholarshipApplication) => {
    if (!studentId) return;
    submitApplication(studentId, a.application_id)
      .then(replaceApp)
      .catch(() => {});
  };

  const sendRecRequest = () => {
    if (!studentId || !recDialogFor || !recName.trim()) return;
    requestRecommendation(studentId, recDialogFor.application_id, recName.trim())
      .then((updated) => {
        replaceApp(updated);
        setNote(t('collegePage.recSent'));
        setTimeout(() => setNote(''), 3000);
        setRecDialogFor(null);
        setRecName('');
      })
      .catch(() => {});
  };

  const markReceived = (a: ScholarshipApplication, name: string) => {
    if (!studentId) return;
    markRecommendationReceived(studentId, a.application_id, name).then(replaceApp).catch(() => {});
  };

  const recordDecision = (awarded: boolean) => {
    if (!studentId || !decisionFor) return;
    const amount = awardAmount ? Number(awardAmount) : undefined;
    recordApplicationOutcome(studentId, decisionFor.application_id, {
      awarded,
      award_amount: awarded ? amount : undefined,
    })
      .then((outcome) => {
        setOutcomes([...outcomes, outcome]);
        setApplications(
          applications.map((a) =>
            a.application_id === decisionFor.application_id
              ? { ...a, status: awarded ? 'awarded' : 'denied' }
              : a,
          ),
        );
        setNote(t('collegePage.decisionSaved'));
        setTimeout(() => setNote(''), 3000);
        setDecisionFor(null);
        setAwardAmount('');
      })
      .catch(() => {});
  };

  const appCard = (a: ScholarshipApplication) => {
    const recs = recLettersOf(a);
    const checklist = a.materials_checklist ?? {};
    const pendingNames = (recs.names ?? []).slice(recs.received);
    return (
      <article key={a.application_id} className="rounded-xl border bg-card p-3 text-sm shadow-sm">
        <p className="font-semibold leading-tight">{a.scholarship?.name ?? a.scholarship_id}</p>
        {a.scholarship?.application_deadline && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('collegePage.deadlineIs')}: {fmtDate(a.scholarship.application_deadline, lang)}
          </p>
        )}

        {appColumn(a) === 'preparing' && (
          <div className="mt-2 space-y-1.5">
            <p className="text-xs font-semibold">{t('collegePage.docsChecklist')}</p>
            {(['essay', 'transcript'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => toggleDoc(a, k)}
                className="flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs hover:bg-muted/50"
              >
                {checklist[k] ? (
                  <CheckCircle2 className={cn('h-4 w-4', A.text)} />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                {k === 'essay' ? t('collegePage.docEssay') : t('collegePage.docTranscript')}
              </button>
            ))}
            <div className="rounded-lg border px-2 py-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span>{t('collegePage.docRecs')}</span>
                <span className="text-muted-foreground">
                  {t('collegePage.recRequested', {
                    requested: recs.requested,
                    received: recs.received,
                  })}
                </span>
              </div>
              {pendingNames.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => markReceived(a, n)}
                  className="mt-1 text-left text-[11px] text-college underline"
                >
                  {n} — {t('collegePage.markReceived')}
                </button>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="mt-1.5 h-7 w-full text-xs"
                onClick={() => setRecDialogFor(a)}
              >
                {t('collegePage.requestRec')}
              </Button>
            </div>
            <Button size="sm" className="w-full" onClick={() => submit(a)}>
              {t('collegePage.moveTo')} {t('boardCols.submitted')}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}

        {(appColumn(a) === 'submitted' || appColumn(a) === 'decision') && (
          <Button
            size="sm"
            variant="outline"
            className="mt-2 w-full"
            onClick={() => setDecisionFor(a)}
          >
            {t('collegePage.recordDecision')}
          </Button>
        )}

        {a.status === 'awarded' && a.award_amount != null && (
          <p className="mt-1 text-xs font-semibold text-emerald-700">{fmtMoney(a.award_amount)}</p>
        )}
      </article>
    );
  };

  const columns: Record<BoardCol, React.ReactNode[]> = {
    saved: savedMatches.map((m) => (
      <article key={m.match_id} className="rounded-xl border bg-card p-3 text-sm shadow-sm">
        <p className="font-semibold leading-tight">{m.scholarship?.name ?? m.scholarship_id}</p>
        {m.scholarship?.application_deadline && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('collegePage.deadlineIs')}: {fmtDate(m.scholarship.application_deadline, lang)}
          </p>
        )}
      </article>
    )),
    preparing: applications.filter((a) => appColumn(a) === 'preparing').map(appCard),
    submitted: applications.filter((a) => appColumn(a) === 'submitted').map(appCard),
    decision: applications.filter((a) => appColumn(a) === 'decision').map(appCard),
    awarded: outcomes
      .filter((o) => o.awarded)
      .map((o) => (
        <article key={o.outcome_id} className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm">
          <p className="font-semibold leading-tight">{o.scholarship?.name ?? o.scholarship_id}</p>
          <p className="mt-0.5 text-xs text-emerald-800">
            {t('collegePage.outcomeAwarded', {
              amount: (o.award_amount ?? 0).toLocaleString('en-US'),
              year: o.award_year,
            })}
          </p>
        </article>
      )),
    not_awarded: outcomes
      .filter((o) => !o.awarded)
      .map((o) => (
        <article key={o.outcome_id} className="rounded-xl border bg-muted/40 p-3 text-sm">
          <p className="font-semibold leading-tight">{o.scholarship?.name ?? o.scholarship_id}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('collegePage.outcomeDenied', { year: o.award_year })}
          </p>
        </article>
      )),
  };

  const empty =
    applications.length === 0 && savedMatches.length === 0 && outcomes.length === 0;

  return (
    <div>
      <h2 className="mb-1 font-display text-lg font-bold">{t('collegePage.trackerTitle')}</h2>
      {note && (
        <p className={cn('mb-3 rounded-xl border px-4 py-2 text-sm', A.soft, A.border, A.text)}>
          {note}
        </p>
      )}
      {empty ? (
        <p className="rounded-2xl border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
          {t('collegePage.noApps')}
        </p>
      ) : (
        <div className="grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
          {BOARD_ORDER.map((col) => (
            <section key={col} className="min-w-60 rounded-2xl bg-muted/30 p-2">
              <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {t(`boardCols.${col}`)} · {columns[col].length}
              </h3>
              <div className="space-y-2">
                {columns[col]}
                {columns[col].length === 0 && (
                  <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                    —
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* request recommendation letter */}
      <Dialog open={!!recDialogFor} onOpenChange={(o) => !o && setRecDialogFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('collegePage.requestRec')}</DialogTitle>
            <DialogDescription>{recDialogFor?.scholarship?.name}</DialogDescription>
          </DialogHeader>
          <Input
            value={recName}
            onChange={(e) => setRecName(e.target.value)}
            placeholder={t('collegePage.recNamePh')}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecDialogFor(null)}>
              {t('app.close')}
            </Button>
            <Button onClick={sendRecRequest} disabled={!recName.trim()}>
              {t('collegePage.requestRec')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* record decision */}
      <Dialog open={!!decisionFor} onOpenChange={(o) => !o && setDecisionFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('collegePage.recordDecision')}</DialogTitle>
            <DialogDescription>{decisionFor?.scholarship?.name}</DialogDescription>
          </DialogHeader>
          <p className="text-sm font-semibold">{t('collegePage.awardedQ')}</p>
          <Input
            value={awardAmount}
            onChange={(e) => setAwardAmount(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder={t('collegePage.awardAmountPh')}
            inputMode="numeric"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => recordDecision(false)}>
              {t('collegePage.awardedNo')}
            </Button>
            <Button onClick={() => recordDecision(true)}>{t('collegePage.awardedYes')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------- essay tab ----------------------------- */

const OUTLINE_KEYS = [1, 2, 3, 4] as const;

function EssayTab({
  studentId,
  essays,
  setEssays,
  storyText,
}: {
  studentId?: string;
  essays: EssayTemplate[];
  setEssays: (e: EssayTemplate[]) => void;
  storyText: string;
}) {
  const { t } = useI18n();
  const [creating, setCreating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [wordLimit, setWordLimit] = useState('');
  const [useStory, setUseStory] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');

  const active = essays.find((e) => e.template_id === activeId) ?? null;
  const wordCount = useMemo(
    () => (draft.trim() ? draft.trim().split(/\s+/).length : 0),
    [draft],
  );

  const create = () => {
    if (!studentId || !prompt.trim()) return;
    createEssayDraft(studentId, {
      prompt_text: prompt.trim(),
      word_limit: wordLimit ? Number(wordLimit) : undefined,
      start_with_story: useStory,
    })
      .then((e) => {
        setEssays([e, ...essays]);
        setActiveId(e.template_id);
        setDraft(e.student_draft ?? '');
        setCreating(false);
        setPrompt('');
        setWordLimit('');
        setUseStory(false);
      })
      .catch(() => {});
  };

  const save = (finalize = false) => {
    if (!studentId || !active) return;
    updateEssayDraft(studentId, active.template_id, {
      student_draft: draft,
      finalized: finalize || undefined,
    })
      .then((updated) => {
        setEssays(essays.map((e) => (e.template_id === updated.template_id ? updated : e)));
        setNote(t('collegePage.draftSaved'));
        setTimeout(() => setNote(''), 3000);
      })
      .catch(() => {});
  };

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">{t('collegePage.essayTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('collegePage.essayNote')}</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <FileText className="mr-1 h-4 w-4" />
          {t('collegePage.newEssay')}
        </Button>
      </div>

      {/* AI assist placeholder — never writes the essay */}
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-dashed bg-muted/40 p-4">
        <Sparkles className="mt-0.5 h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold">{t('collegePage.aiPlaceholder')}</p>
          <p className="text-xs text-muted-foreground">{t('collegePage.aiPlaceholderNote')}</p>
        </div>
      </div>

      {note && (
        <p className={cn('mb-3 rounded-xl border px-4 py-2 text-sm', A.soft, A.border, A.text)}>
          {note}
        </p>
      )}

      {creating && (
        <div className="mb-4 rounded-2xl border bg-card p-4 shadow-sm">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('collegePage.promptPh')}
            rows={3}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Input
              className="w-36"
              value={wordLimit}
              onChange={(e) => setWordLimit(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder={t('collegePage.wordLimit')}
              inputMode="numeric"
            />
            {storyText && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={useStory}
                  onChange={(e) => setUseStory(e.target.checked)}
                  className="h-4 w-4 accent-[#C9A961]"
                />
                {t('collegePage.startStory')}
              </label>
            )}
            <Button size="sm" onClick={create} disabled={!prompt.trim()}>
              {t('collegePage.createDraft')}
            </Button>
          </div>
        </div>
      )}

      {essays.length === 0 && !creating ? (
        <p className="rounded-2xl border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
          {t('collegePage.noEssays')}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <aside className="space-y-2">
            {essays.map((e) => (
              <button
                key={e.template_id}
                type="button"
                onClick={() => {
                  setActiveId(e.template_id);
                  setDraft(e.student_draft ?? '');
                }}
                className={cn(
                  'w-full rounded-xl border p-3 text-left text-sm',
                  activeId === e.template_id ? cn(A.border, A.soft) : 'bg-card hover:bg-muted/40',
                )}
              >
                <p className="line-clamp-2 font-semibold leading-tight">{e.prompt_text}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  {e.finalized_at && (
                    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                      {t('collegePage.finalTag')}
                    </Badge>
                  )}
                  {e.word_limit != null && <span>{e.word_limit}w</span>}
                </div>
              </button>
            ))}
          </aside>

          {active ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border bg-card p-4">
                <h3 className="mb-2 text-sm font-bold">{t('collegePage.outlineTitle')}</h3>
                <ol className="space-y-3">
                  {OUTLINE_KEYS.map((n) => (
                    <li key={n} className="text-sm">
                      <p className="font-semibold">
                        {n}. {t(`collegePage.outline${n}h`)}
                      </p>
                      <p className="text-xs text-muted-foreground">{t(`collegePage.outline${n}b`)}</p>
                    </li>
                  ))}
                </ol>
              </section>
              <section className="rounded-2xl border bg-card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold">{t('collegePage.yourDraft')}</h3>
                  <span className="text-xs text-muted-foreground">
                    {t('collegePage.words', { count: wordCount })}
                    {active.word_limit != null && ` / ${active.word_limit}`}
                  </span>
                </div>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={12}
                  className="text-sm"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => save(false)}>
                    {t('collegePage.saveDraft')}
                  </Button>
                  {!active.finalized_at && (
                    <Button size="sm" onClick={() => save(true)}>
                      {t('collegePage.finalize')}
                    </Button>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">←</p>
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------------- play in college --------------------------- */

function PlayTab({
  colleges,
  fitById,
  hasAthletic,
  compass,
}: {
  colleges: College[];
  fitById: Map<string, CollegeFitResult>;
  hasAthletic: boolean;
  compass: PathwayCompass | null;
}) {
  const { t } = useI18n();
  const sportSchools = colleges.filter((c) => c.soccer_program !== 'none');
  const playsSport = hasAthletic || !!compass?.sport?.plays;

  return (
    <div>
      <h2 className="font-display text-lg font-bold">{t('collegePage.playTitle')}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{t('collegePage.playNote')}</p>

      <section className="mb-6 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Landmark className={cn('h-5 w-5', A.text)} />
          <h3 className="font-bold">{t('collegePage.eligTitle')}</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t('collegePage.eligNote')}</p>
        <ul className="mt-3 space-y-2">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <li key={n} className="flex items-start gap-2 text-sm">
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              {t(`collegePage.elig${n}`)}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">{t('collegePage.playProfile')}</h3>
            <p className="text-sm text-muted-foreground">
              {playsSport ? compass?.sport?.sport ?? '' : ''}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/sports">
              {t('collegePage.playCta')}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <h3 className="mb-3 font-bold">{t('collegePage.schoolsWithSport')}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sportSchools.map((c) => {
          const fit = fitById.get(c.college_id);
          return (
            <article key={c.college_id} className="rounded-xl border bg-card p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold leading-tight">{c.name}</p>
                {fit && (
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                      FIT_STYLE[fit.fit],
                    )}
                  >
                    {t(`fitLabels.${fit.fit}`)}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {c.city}, {c.state_or_region}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="border-sports/40 bg-sports-soft text-sports">
                  <Trophy className="mr-1 h-3 w-3" />
                  {c.soccer_level}
                </Badge>
                <Badge variant="outline">
                  {c.soccer_scholarships
                    ? t('collegePage.athleticMoney')
                    : t('collegePage.noAthleticMoney')}
                </Badge>
                {c.racing_partner && (
                  <Badge variant="outline" className="border-career/40 bg-career-soft text-career">
                    {t('collegePage.racingBadge')}
                  </Badge>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------- financial aid (parent-only) ------------------- */

const AID_DOC_KEYS = [1, 2, 3, 4, 5] as const;
const AID_DL_KEYS = [1, 2, 3] as const;

/** Student-facing gate: the helper is for parents/guardians. */
function AidGate() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-xl rounded-2xl border-2 border-dashed p-8 text-center">
      <Wallet className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{t('collegePage.aidParentOnly')}</p>
    </div>
  );
}

/**
 * Parent-only FAFSA/TASFA helper. DEMO ONLY — the checklist lives in
 * component state, and the submit endpoint accepts and discards. No income
 * field exists anywhere in this front end.
 */
function AidTab({ studentId }: { studentId?: string }) {
  const { t } = useI18n();
  const [aidType, setAidType] = useState<'fafsa' | 'tasfa' | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [savedDemo, setSavedDemo] = useState(false);

  const toggle = (n: number) => {
    const next = new Set(checked);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    setChecked(next);
  };

  const submitDemo = () => {
    if (!studentId) return;
    submitAidHelper(studentId)
      .then(() => {
        setSavedDemo(true);
        setTimeout(() => setSavedDemo(false), 3000);
      })
      .catch(() => {});
  };

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg font-bold">{t('collegePage.aidTitle')}</h2>
        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
          {t('collegePage.aidDemoBadge')}
        </Badge>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t('collegePage.aidParentOnly')}</p>

      <section className="mb-4 rounded-2xl border bg-card p-4 shadow-sm">
        <h3 className="font-bold">{t('collegePage.aidWhat')}</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-muted/40 p-3 text-sm">
            <p className="font-semibold">FAFSA</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('collegePage.aidFafsa')}</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3 text-sm">
            <p className="font-semibold">TASFA</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('collegePage.aidTasfa')}</p>
          </div>
        </div>
      </section>

      <section className="mb-4 rounded-2xl border bg-card p-4 shadow-sm">
        <h3 className="font-bold">{t('collegePage.aidWhich')}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={aidType === 'fafsa' ? 'default' : 'outline'}
            onClick={() => setAidType('fafsa')}
          >
            {t('collegePage.aidPickFafsa')}
          </Button>
          <Button
            size="sm"
            variant={aidType === 'tasfa' ? 'default' : 'outline'}
            onClick={() => setAidType('tasfa')}
          >
            {t('collegePage.aidPickTasfa')}
          </Button>
        </div>
      </section>

      <section className="mb-4 rounded-2xl border bg-card p-4 shadow-sm">
        <h3 className="font-bold">{t('collegePage.aidDocs')}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{t('collegePage.aidChecklistNote')}</p>
        <ul className="mt-3 space-y-2">
          {AID_DOC_KEYS.map((n) => (
            <li key={n}>
              <button
                type="button"
                onClick={() => toggle(n)}
                className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/50"
              >
                {checked.has(n) ? (
                  <CheckCircle2 className={cn('h-4 w-4', A.text)} />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                {t(`collegePage.aidDoc${n}`)}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-4 rounded-2xl border bg-card p-4 shadow-sm">
        <h3 className="font-bold">{t('collegePage.aidDeadlines')}</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {AID_DL_KEYS.map((n) => (
            <li key={n}>{t(`collegePage.aidDl${n}`)}</li>
          ))}
        </ul>
      </section>

      <p className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        {t('collegePage.aidNoIncome')}
      </p>

      {studentId && (
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={submitDemo}>
            {t('collegePage.aidDemoBadge')}
          </Button>
          {savedDemo && <span className="text-sm text-emerald-700">✓</span>}
        </div>
      )}
    </div>
  );
}

/* --------------------------- explorer (under 13) ------------------------ */

function ExplorerLite({ colleges }: { colleges: College[] }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-2">
        <Globe2 className={cn('h-7 w-7', A.text)} />
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          {t('collegePage.title')}
        </h1>
      </div>
      <p className="mt-3 rounded-2xl border-2 border-gold/50 bg-gold-soft/50 p-4 text-sm">
        {t('collegePage.explorerNote')}
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {colleges.slice(0, 8).map((c) => (
          <article key={c.college_id} className="rounded-xl border bg-card p-3 shadow-sm">
            <p className="text-sm font-semibold leading-tight">{c.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {c.city}, {c.state_or_region} · {c.country}
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              {c.language_of_instruction}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
