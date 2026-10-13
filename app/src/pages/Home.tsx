/**
 * Home — role dispatch.
 * Student: full dashboard (My Plan timeline, pathway progress, saved items,
 * deadlines, messages, My Story) or the Explorer home for under-13s.
 * Parent: children list with the turning-13 promotion card.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useI18n } from '@/i18n';
import { getSession } from '@/api/auth';
import {
  getAthleticProfiles,
  getDeadlines,
  getDocuments,
  getInterests,
  getMessages,
  getMyStory,
  getPlanActions,
  getRacing360Reports,
  getSavedCareers,
  getSavedColleges,
  getScholarshipMatches,
  getStudent,
  getVideos,
  listCareers,
  markMessageRead,
  updateInterests,
  updateMyStory,
  updatePlanAction,
} from '@/api';
import type {
  AppStudent,
  AthleticProfile,
  Career,
  Deadline,
  DemoRole,
  InterestKey,
  PlanAction,
  SavedCareer,
  SavedCollege,
  ScholarshipMatch,
  StudentMessage,
} from '@/api/types';
import { QueryBoundary } from '@/components/QueryBoundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  Bookmark,
  Briefcase,
  CalendarDays,
  CircleCheck,
  Circle,
  GraduationCap,
  IdCard,
  MessageSquare,
  NotebookPen,
  PartyPopper,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { ACCENT } from './pathwayAccents';
import { cn } from '@/lib/utils';

export default function Home() {
  const role: DemoRole = getSession()?.user.role ?? 'student';
  switch (role) {
    case 'parent':
      return <Navigate to="/parent" replace />;
    case 'coach':
      return <Navigate to="/staff" replace />;
    case 'club_staff':
      return <Navigate to="/talent" replace />;
    case 'partner':
      return <Navigate to="/partner" replace />;
    case 'admin':
      return <Navigate to="/admin" replace />;
    default:
      return <StudentHome />;
  }
}

function fmtDate(iso: string, lang: string): string {
  try {
    return new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString(
      lang === 'es' ? 'es-MX' : 'en-US',
      { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' },
    );
  } catch {
    return iso;
  }
}

/* ============================ STUDENT HOME ============================== */

function StudentHome() {
  const studentId = getSession()?.user.student_id;
  const [student, setStudent] = useState<AppStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    getStudent(studentId)
      .then(setStudent)
      .catch(setError)
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [studentId]);

  return (
    <QueryBoundary loading={loading} error={error} onRetry={load}>
      {student && (student.app_mode === 'explorer' ? <ExplorerHome student={student} /> : <PathwaysDashboard student={student} />)}
    </QueryBoundary>
  );
}

function Greeting({ student }: { student: AppStudent }) {
  const { t } = useI18n();
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-deep">{t('home.greeting')}</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
        {t('home.greetingStudent', { name: student.preferred_name || student.first_name })}
        {student.is_sample && (
          <Badge variant="outline" className="ml-3 align-middle text-[10px]">{t('app.sampleBadge')}</Badge>
        )}
      </h1>
    </div>
  );
}

function PathwaysDashboard({ student }: { student: AppStudent }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const sid = student.student_id;

  const [actions, setActions] = useState<PlanAction[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [messages, setMessages] = useState<StudentMessage[]>([]);
  const [savedCareers, setSavedCareers] = useState<SavedCareer[]>([]);
  const [savedColleges, setSavedColleges] = useState<SavedCollege[]>([]);
  const [bookmarked, setBookmarked] = useState<ScholarshipMatch[]>([]);
  const [sportsPct, setSportsPct] = useState(0);
  const [story, setStory] = useState('');
  const [storyDraft, setStoryDraft] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      getPlanActions(sid),
      getDeadlines(sid),
      getMessages(sid),
      getSavedCareers(sid),
      getSavedColleges(sid),
      getScholarshipMatches(sid, { dismissed: false }).catch(() => ({ data: [] as ScholarshipMatch[], summary: undefined })),
      getAthleticProfiles(sid),
      getRacing360Reports(sid),
      getVideos(sid).catch(() => ({ data: [], summary: undefined })),
      getDocuments(sid),
      getMyStory(sid),
    ])
      .then(([pa, dl, msg, sc, sk, matches, ath, r360, vids, docs, ms]) => {
        setActions(pa.data);
        setDeadlines(dl.data.slice(0, 6));
        setMessages(msg.data.slice(0, 3));
        setSavedCareers(sc.data);
        setSavedColleges(sk.data);
        setBookmarked(matches.data.filter((m) => m.bookmarked));
        // Sports profile completeness: profile, position, level, R360 report, video, doc.
        const profile = ath.data[0];
        let pts = 0;
        if (profile) pts += 30;
        if (profile?.position) pts += 15;
        if (profile?.team_name) pts += 15;
        if (r360.data.length > 0) pts += 20;
        if (vids.data.length > 0) pts += 10;
        if (docs.data.length > 0) pts += 10;
        setSportsPct(Math.min(100, pts));
        setStory(ms.text);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [sid]);

  const compassDone = student.pathway_compass?.completed;

  const nextActions = useMemo(
    () => actions.filter((a) => a.status === 'todo').slice(0, 3),
    [actions],
  );

  const progress = useMemo(() => {
    const career = Math.min(100, (compassDone ? 40 : 0) + (savedCareers.length ? 40 : 0) + (actions.some((a) => a.pathway === 'career' && a.status === 'done') ? 20 : 0));
    const college = Math.min(100, (compassDone ? 30 : 0) + (savedColleges.length ? 30 : 0) + (bookmarked.length ? 20 : 0) + (actions.some((a) => a.pathway === 'college' && a.status === 'done') ? 20 : 0));
    return { career, college, sports: sportsPct };
  }, [compassDone, savedCareers.length, savedColleges.length, bookmarked.length, actions, sportsPct]);

  const toggleAction = async (a: PlanAction) => {
    try {
      const updated = await updatePlanAction(sid, a.action_id, {
        status: a.status === 'done' ? 'todo' : 'done',
      });
      setActions((l) => l.map((x) => (x.action_id === a.action_id ? updated : x)));
    } catch (e) {
      setError(e);
    }
  };

  const openMessage = async (m: StudentMessage) => {
    if (m.read_at) return;
    try {
      const updated = await markMessageRead(sid, m.message_id);
      setMessages((l) => l.map((x) => (x.message_id === m.message_id ? updated : x)));
    } catch {
      /* non-blocking */
    }
  };

  const saveStory = async () => {
    if (storyDraft === null) return;
    try {
      const saved = await updateMyStory(sid, storyDraft);
      setStory(saved.text);
      setStoryDraft(null);
    } catch (e) {
      setError(e);
    }
  };

  const kindBadge: Record<Deadline['kind'], string> = {
    scholarship: 'dashboard.kindScholarship',
    tryout: 'dashboard.kindTryout',
    class_start: 'dashboard.kindClassStart',
    application: 'dashboard.kindApplication',
  };

  return (
    <QueryBoundary loading={loading} error={error} onRetry={load}>
      <div>
        <div className="flex items-start justify-between gap-3">
          <Greeting student={student} />
          <Button variant="outline" className="min-touch shrink-0 rounded-full" onClick={() => navigate('/profile')}>
            <IdCard className="size-4" aria-hidden />
            {t('dashboard.viewProfile')}
          </Button>
        </div>

        {!compassDone && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-gold bg-gold-soft p-5">
            <div className="flex items-center gap-3">
              <Sparkles className="size-6 shrink-0 text-gold-deep" aria-hidden />
              <p className="font-medium">{t('dashboard.finishCompass')}</p>
            </div>
            <Button className="min-touch rounded-full" onClick={() => navigate('/compass')}>
              {t('dashboard.startCompass')} →
            </Button>
          </div>
        )}
        {compassDone && (
          <p className="mt-4 text-sm">
            <Link to="/compass/results" className="font-semibold text-gold-deep underline">
              {t('results.title')} →
            </Link>
          </p>
        )}

        {/* My Plan — next 3 actions across pathways */}
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold tracking-tight">{t('dashboard.nextActions')}</h2>
          <div className="mt-3 space-y-2.5">
            {nextActions.length === 0 && (
              <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">{t('dashboard.noActions')}</p>
            )}
            {nextActions.map((a) => {
              const done = a.status === 'done';
              return (
                <div key={a.action_id} className={cn('flex items-center gap-3 rounded-2xl border-2 bg-card p-4', ACCENT[a.pathway].border)}>
                  <button
                    type="button"
                    className="min-touch shrink-0 rounded-full"
                    aria-label={done ? t('dashboard.markTodo') : t('dashboard.markDone')}
                    onClick={() => void toggleAction(a)}
                  >
                    {done ? (
                      <CircleCheck className="size-6 text-gold-deep" aria-hidden />
                    ) : (
                      <Circle className="size-6 text-muted-foreground" aria-hidden />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm font-medium', done && 'line-through opacity-60')}>
                      {lang === 'es' ? a.title_es : a.title_en}
                    </p>
                    {a.due_date && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t('dashboard.due', { date: fmtDate(a.due_date, lang) })}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className={cn('shrink-0 text-[10px]', ACCENT[a.pathway].text)}>
                    {t(`dashboard.progress${a.pathway === 'career' ? 'Career' : a.pathway === 'college' ? 'College' : 'Sports'}`)}
                  </Badge>
                </div>
              );
            })}
          </div>
        </section>

        {/* Progress per pathway */}
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold tracking-tight">{t('dashboard.progress')}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {(['career', 'college', 'sports'] as const).map((p) => (
              <div key={p} className={cn('rounded-2xl border-2 bg-card p-4', ACCENT[p].border)}>
                <div className="flex items-center gap-2">
                  <span className={cn('inline-grid size-8 place-items-center rounded-lg', ACCENT[p].soft)}>
                    {p === 'career' && <Briefcase className={cn('size-4', ACCENT[p].text)} aria-hidden />}
                    {p === 'college' && <GraduationCap className={cn('size-4', ACCENT[p].text)} aria-hidden />}
                    {p === 'sports' && <Trophy className={cn('size-4', ACCENT[p].text)} aria-hidden />}
                  </span>
                  <p className="text-sm font-semibold">
                    {p === 'career' ? t('dashboard.progressCareer') : p === 'college' ? t('dashboard.progressCollege') : t('dashboard.progressSports')}
                  </p>
                  <span className="ml-auto text-xs font-bold text-muted-foreground">{progress[p]}%</span>
                </div>
                <Progress value={progress[p]} className="mt-3 h-2" />
                {p === 'sports' && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{t('dashboard.completeness')}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Saved items */}
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <SavedCard title={t('dashboard.savedCareers')} items={savedCareers.map((s) => (lang === 'es' ? s.career?.title_es : s.career?.title_en) ?? s.career_id)} emptyKey="dashboard.nothingSaved" />
          <SavedCard title={t('dashboard.savedColleges')} items={savedColleges.map((s) => s.college?.name ?? s.college_id)} emptyKey="dashboard.nothingSaved" />
          <SavedCard title={t('dashboard.savedScholarships')} items={bookmarked.map((m) => m.scholarship?.name ?? m.scholarship_id)} emptyKey="dashboard.nothingSaved" />
        </section>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {/* Deadlines */}
          <section className="rounded-2xl border-2 border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-5 text-gold-deep" aria-hidden />
              <h2 className="font-display text-lg font-bold tracking-tight">{t('dashboard.deadlines')}</h2>
            </div>
            <ul className="mt-3 space-y-2.5">
              {deadlines.length === 0 && <li className="text-sm text-muted-foreground">{t('dashboard.noDeadlines')}</li>}
              {deadlines.map((d) => (
                <li key={d.deadline_id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <Badge variant="outline" className="mr-2 text-[10px]">{t(kindBadge[d.kind])}</Badge>
                    {lang === 'es' ? d.title_es : d.title_en}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-gold-deep">{fmtDate(d.date, lang)}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Messages */}
          <section className="rounded-2xl border-2 border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-5 text-gold-deep" aria-hidden />
              <h2 className="font-display text-lg font-bold tracking-tight">{t('dashboard.messages')}</h2>
            </div>
            <ul className="mt-3 space-y-2.5">
              {messages.length === 0 && <li className="text-sm text-muted-foreground">{t('dashboard.noMessages')}</li>}
              {messages.map((m) => (
                <li key={m.message_id}>
                  <button
                    type="button"
                    className={cn('min-touch w-full rounded-xl border p-3 text-left', !m.read_at && 'border-gold/60 bg-gold-soft/40')}
                    onClick={() => void openMessage(m)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold">
                        {m.from_name}
                        <span className="ml-2 font-normal text-muted-foreground">
                          {m.from_role === 'coach' ? t('dashboard.fromCoach') : t('dashboard.fromCounselor')}
                        </span>
                      </p>
                      <span className="text-[10px] text-muted-foreground">{fmtDate(m.sent_at, lang)}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{lang === 'es' ? m.body_es : m.body_en}</p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* My Story */}
        <section className="mt-8 rounded-2xl border-2 border-gold/60 bg-gold-soft/40 p-5">
          <div className="flex items-center gap-2">
            <NotebookPen className="size-5 text-gold-deep" aria-hidden />
            <h2 className="font-display text-lg font-bold tracking-tight">{t('dashboard.myStory')}</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t('dashboard.myStoryHint')}</p>
          {storyDraft === null ? (
            <div className="mt-3">
              {story ? (
                <p className="whitespace-pre-wrap rounded-xl bg-card p-4 text-sm leading-relaxed">{story}</p>
              ) : (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{t('dashboard.myStoryPlaceholder')}</p>
              )}
              <Button variant="outline" className="mt-3 min-touch rounded-full" onClick={() => setStoryDraft(story)}>
                {story ? t('app.edit') : t('dashboard.writeStory')}
              </Button>
            </div>
          ) : (
            <div className="mt-3">
              <Textarea
                value={storyDraft}
                onChange={(e) => setStoryDraft(e.target.value.slice(0, 1000))}
                rows={4}
                placeholder={t('dashboard.myStoryPlaceholder')}
                className="bg-card"
              />
              <div className="mt-3 flex gap-2">
                <Button className="min-touch rounded-full" onClick={() => void saveStory()}>{t('app.save')}</Button>
                <Button variant="ghost" className="min-touch rounded-full" onClick={() => setStoryDraft(null)}>{t('app.cancel')}</Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </QueryBoundary>
  );
}

function SavedCard({ title, items, emptyKey }: { title: string; items: string[]; emptyKey: string }) {
  const { t } = useI18n();
  return (
    <section className="rounded-2xl border-2 border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Bookmark className="size-4 text-gold-deep" aria-hidden />
        <h3 className="text-sm font-bold">{title}</h3>
        <span className="ml-auto text-xs font-semibold text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{t(emptyKey)}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.slice(0, 4).map((x) => (
            <li key={x} className="truncate rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs font-medium">{x}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ============================ EXPLORER HOME ============================= */

const EXPLORER_WORK_IDS = ['car-sample-001', 'car-sample-002', 'car-sample-007', 'car-sample-010'];

function ExplorerHome({ student }: { student: AppStudent }) {
  const { t, lang } = useI18n();
  const sid = student.student_id;
  const [careers, setCareers] = useState<Career[]>([]);
  const [athletic, setAthletic] = useState<AthleticProfile | null>(null);
  const [picks, setPicks] = useState<InterestKey[]>([]);
  const [savedGame, setSavedGame] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([listCareers({ page_size: 50 }), getAthleticProfiles(sid), getInterests(sid)])
      .then(([car, ath, ints]) => {
        setCareers(EXPLORER_WORK_IDS.map((id) => car.data.find((c) => c.career_id === id)).filter(Boolean) as Career[]);
        setAthletic(ath.data[0] ?? null);
        setPicks(ints.data.map((x) => x.career_field).filter((x): x is InterestKey => INTEREST_SET.has(x as InterestKey)));
      })
      .catch(setError)
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [sid]);

  const saveGame = async (next: InterestKey[]) => {
    setPicks(next);
    setSavedGame(false);
    try {
      await updateInterests(sid, next.map((f) => ({ career_field: f, interest_level: 4 })));
      setSavedGame(true);
    } catch (e) {
      setError(e);
    }
  };

  const profile = athletic;

  return (
    <QueryBoundary loading={loading} error={error} onRetry={load}>
      <div>
        <Greeting student={student} />
        <p className="mt-3 rounded-2xl border-2 border-gold/60 bg-gold-soft p-4 text-sm">{t('explorer.modeNote')}</p>

        {/* What do people do at work */}
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold tracking-tight">{t('explorer.workTitle')}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {careers.map((c) => (
              <div key={c.career_id} className="rounded-2xl border-2 border-career bg-card p-4">
                <p className="font-display text-base font-bold">{lang === 'es' ? c.title_es : c.title_en}</p>
                <p className="mt-1 text-sm text-muted-foreground">{lang === 'es' ? c.summary_es : c.summary_en}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Soccer profile */}
        <section className="mt-8 rounded-2xl border-2 border-sports bg-card p-5">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-sports" aria-hidden />
            <h2 className="font-display text-lg font-bold tracking-tight">{t('explorer.soccerTitle')}</h2>
          </div>
          {profile ? (
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">{t('explorer.soccerTeam')}</dt>
                <dd className="font-medium">{profile.team_name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('explorer.soccerPosition')}</dt>
                <dd className="font-medium">{profile.position ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('explorer.soccerYears')}</dt>
                <dd className="font-medium">{profile.years_experience ?? '—'}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">{t('profile.noSport')}</p>
          )}
        </section>

        {/* Interests game */}
        <section className="mt-8 rounded-2xl border-2 border-college bg-card p-5">
          <div className="flex items-center gap-2">
            <PartyPopper className="size-5 text-college" aria-hidden />
            <h2 className="font-display text-lg font-bold tracking-tight">{t('explorer.gameTitle')}</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t('explorer.gameHint')}</p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {INTEREST_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                className={cn(
                  'min-touch rounded-full border-2 px-4 py-2.5 text-sm font-medium transition-colors',
                  picks.includes(k) ? 'border-gold bg-gold-soft' : 'border-border hover:border-gold/60',
                )}
                onClick={() => void saveGame(picks.includes(k) ? picks.filter((x) => x !== k) : [...picks, k])}
              >
                {t(`interests.${k}`)}
              </button>
            ))}
          </div>
          {savedGame && <p className="mt-3 text-sm font-medium text-gold-deep">{t('explorer.gameSaved')}</p>}
        </section>

        {/* Futures previews */}
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold tracking-tight">{t('explorer.futuresTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('explorer.futuresNote')}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {(['career', 'college', 'sports'] as const).map((p) => (
              <div key={p} className={cn('relative rounded-2xl border-2 border-dashed bg-card p-5', ACCENT[p].border)}>
                <Badge variant="outline" className="absolute right-3 top-3 text-[10px]">{t('explorer.locked')}</Badge>
                <span className={cn('inline-grid size-10 place-items-center rounded-xl opacity-60', ACCENT[p].soft)}>
                  {p === 'career' && <Briefcase className={cn('size-5', ACCENT[p].text)} aria-hidden />}
                  {p === 'college' && <GraduationCap className={cn('size-5', ACCENT[p].text)} aria-hidden />}
                  {p === 'sports' && <Trophy className={cn('size-5', ACCENT[p].text)} aria-hidden />}
                </span>
                <p className="mt-3 font-display text-base font-bold opacity-70">
                  {p === 'career' ? t('pathways.career') : p === 'college' ? t('pathways.college') : t('pathways.sports')}
                </p>
              </div>
            ))}
          </div>
        </section>

        <p className="mt-8 rounded-2xl bg-muted/60 p-4 text-xs text-muted-foreground">{t('explorer.noContactNote')}</p>
      </div>
    </QueryBoundary>
  );
}

const INTEREST_KEYS: InterestKey[] = [
  'hands_on', 'helping_people', 'tech', 'building', 'outdoors', 'business', 'health', 'art', 'sports',
];
const INTEREST_SET = new Set<string>(INTEREST_KEYS);

/* ============================= PARENT HOME ============================== */





export function PathwayCard({
  to,
  icon: Icon,
  title,
  desc,
  accent,
}: {
  to: string;
  icon: typeof Briefcase;
  title: string;
  desc: string;
  accent: 'career' | 'college' | 'sports';
}) {
  const c = ACCENT[accent];
  return (
    <Link
      to={to}
      className={`group rounded-2xl border-2 ${c.border} bg-card p-5 transition-transform hover:-translate-y-0.5`}
    >
      <span className={`inline-grid size-11 place-items-center rounded-xl ${c.soft}`}>
        <Icon className={`size-6 ${c.text}`} aria-hidden />
      </span>
      <p className="mt-3 font-display text-lg font-bold tracking-tight">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </Link>
  );
}
