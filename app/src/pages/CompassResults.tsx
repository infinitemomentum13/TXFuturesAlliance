/**
 * Compass results — the three pathways side by side with a fit indicator,
 * 2–3 top suggestions each, a one-line "because you said…" explanation,
 * and a combined-plan example. Ordering and warmth follow income urgency.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useI18n } from '@/i18n';
import { getSession } from '@/api/auth';
import {
  getAthleticProfiles,
  getRacing360Reports,
  getSavedCareers,
  getSavedColleges,
  getStudent,
  listCareers,
  listColleges,
  saveCareer,
  saveCollege,
  unsaveCareer,
  unsaveCollege,
} from '@/api';
import type { AppStudent, Career, College, SavedCareer, SavedCollege } from '@/api/types';
import { QueryBoundary } from '@/components/QueryBoundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bookmark, Briefcase, GraduationCap, Layers, Trophy } from 'lucide-react';
import { ACCENT } from './pathwayAccents';
import { cn } from '@/lib/utils';

type Fit = 'strong' | 'good' | 'explore';
type Pathway = 'career' | 'college' | 'sports';

export default function CompassResults() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const studentId = getSession()?.user.student_id;

  const [student, setStudent] = useState<AppStudent | null>(null);
  const [careers, setCareers] = useState<Career[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [savedCareers, setSavedCareers] = useState<SavedCareer[]>([]);
  const [savedColleges, setSavedColleges] = useState<SavedCollege[]>([]);
  const [athleticCount, setAthleticCount] = useState(0);
  const [academyLevel, setAcademyLevel] = useState(false);
  const [r360Count, setR360Count] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      getStudent(studentId),
      listCareers({ page_size: 50 }),
      listColleges({ page_size: 50 }),
      getSavedCareers(studentId),
      getSavedColleges(studentId),
      getAthleticProfiles(studentId),
      getRacing360Reports(studentId),
    ])
      .then(([s, car, col, sc, sk, ath, r360]) => {
        setStudent(s);
        setCareers(car.data);
        setColleges(col.data);
        setSavedCareers(sc.data);
        setSavedColleges(sk.data);
        setAthleticCount(ath.data.length);
        setAcademyLevel(
          ath.data.some((a) => a.competitive_level === 'Academy' || a.competitive_level === 'Premier'),
        );
        setR360Count(r360.data.length);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [studentId]);

  // Redirect explorers — results belong to pathways mode.
  useEffect(() => {
    if (student?.app_mode === 'explorer') navigate('/', { replace: true });
  }, [student, navigate]);

  const model = useMemo(() => {
    if (!student) return null;
    const c = student.pathway_compass;
    const urgent = c?.income_urgency === 'right_away' || c?.income_urgency === 'within_a_year';
    const interests = c?.interests ?? [];
    const openTo = c?.open_to ?? [];

    /* ---- fit scores ---- */
    let career = 1;
    if (c?.income_urgency === 'right_away') career += 3;
    if (c?.income_urgency === 'within_a_year') career += 2;
    career += Math.min(2, interests.filter((i) => ['hands_on', 'building', 'tech', 'outdoors'].includes(i)).length);

    let college = 1;
    const grades = c?.grades;
    const gpaKnownGood =
      grades?.kind === 'gpa_range' && (grades.gpa_range === '3_to_35' || grades.gpa_range === '35_plus');
    if (gpaKnownGood) college += 2;
    if (c?.income_urgency === 'after_high_school' || c?.income_urgency === 'not_a_pressure') college += 2;
    if (openTo.some((o) => o !== 'rgv')) college += 1;
    if (c?.first_generation) college += 1;

    let sports = 0;
    if (athleticCount > 0 || c?.sport?.plays) sports += 2;
    if (academyLevel || c?.sport?.level === 'fcb_academy') sports += 1;
    if (r360Count > 0) sports += 1;
    if (openTo.includes('spain') || openTo.includes('mexico')) sports += 1;

    const label = (score: number): Fit => (score >= 5 ? 'strong' : score >= 3 ? 'good' : 'explore');

    /* ---- why sentences ---- */
    const whyCareer: string[] = [];
    if (urgent) whyCareer.push(t('results.whyIncome'));
    if (interests.includes('hands_on')) whyCareer.push(t('results.whyHandsOn'));
    else if (interests[0]) whyCareer.push(t('results.whyInterest', { interest: t(`interests.${interests[0]}`).toLowerCase() }));

    const whyCollege: string[] = [];
    if (gpaKnownGood) whyCollege.push(t('results.whyGrades'));
    if (openTo.includes('spain') || openTo.includes('mexico') || openTo.includes('other_country'))
      whyCollege.push(
        t('results.whyAbroad', {
          place: t(`openTo.${openTo.includes('spain') ? 'spain' : openTo.includes('mexico') ? 'mexico' : 'other_country'}`),
        }),
      );
    if (c?.first_generation) whyCollege.push(t('results.whyFirstGen'));
    if (whyCollege.length === 0 && (c?.income_urgency === 'after_high_school' || c?.income_urgency === 'not_a_pressure'))
      whyCollege.push(t('results.whyIncome').replace('soon', 'later'));

    const whySports: string[] = [];
    if (c?.sport?.plays || athleticCount > 0) whySports.push(t('results.whySport', { sport: c?.sport?.sport ?? 'soccer' }));
    if (academyLevel || c?.sport?.level === 'fcb_academy') whySports.push(t('results.whyAcademy'));

    /* ---- suggestions ---- */
    const careerSug = interests.length
      ? careers.filter((car) => {
          const sectors = interests.flatMap((i) => CAREER_SECTORS[i] ?? []);
          return sectors.includes(car.sector);
        })
      : careers;
    const collegeSug = colleges.filter((col) => {
      if (openTo.length === 0) return true;
      return openTo.some((o) => {
        if (o === 'rgv') return col.in_rgv;
        if (o === 'texas') return col.country === 'US' && col.state_or_region === 'TX';
        if (o === 'us') return col.country === 'US';
        if (o === 'mexico') return col.country === 'MX';
        if (o === 'spain') return col.country === 'ES';
        return col.country === 'OTHER';
      });
    });

    const order: Pathway[] = urgent
      ? ['career', 'college', 'sports']
      : ['college', 'sports', 'career'];

    return {
      urgent,
      order,
      fit: { career: label(career), college: label(college), sports: label(sports) } as Record<Pathway, Fit>,
      why: { career: whyCareer, college: whyCollege, sports: whySports } as Record<Pathway, string[]>,
      careerSug: (careerSug.length ? careerSug : careers).slice(0, 3),
      collegeSug: (collegeSug.length ? collegeSug : colleges).slice(0, 3),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student, careers, colleges, athleticCount, academyLevel, r360Count, lang]);

  const toggleCareer = async (careerId: string) => {
    if (!studentId) return;
    const existing = savedCareers.find((x) => x.career_id === careerId);
    try {
      if (existing) {
        await unsaveCareer(studentId, existing.saved_id);
        setSavedCareers((l) => l.filter((x) => x.saved_id !== existing.saved_id));
      } else {
        const s = await saveCareer(studentId, careerId);
        setSavedCareers((l) => [...l, s]);
      }
    } catch (e) {
      setError(e);
    }
  };

  const toggleCollege = async (collegeId: string) => {
    if (!studentId) return;
    const existing = savedColleges.find((x) => x.college_id === collegeId);
    try {
      if (existing) {
        await unsaveCollege(studentId, existing.saved_id);
        setSavedColleges((l) => l.filter((x) => x.saved_id !== existing.saved_id));
      } else {
        const s = await saveCollege(studentId, collegeId);
        setSavedColleges((l) => [...l, s]);
      }
    } catch (e) {
      setError(e);
    }
  };

  const fitBadge = (fit: Fit) => (
    <Badge
      variant="outline"
      className={cn(
        'text-[11px]',
        fit === 'strong' && 'border-gold bg-gold-soft text-gold-deep',
        fit === 'good' && 'border-border',
        fit === 'explore' && 'border-dashed text-muted-foreground',
      )}
    >
      {fit === 'strong' ? t('results.fitStrong') : fit === 'good' ? t('results.fitGood') : t('results.fitExplore')}
    </Badge>
  );

  const compassDone = student?.pathway_compass?.completed;

  return (
    <QueryBoundary loading={loading} error={error} onRetry={load}>
      {student && model && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-deep">
            {t('compass.title')}
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">{t('results.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('results.subtitle')}</p>

          {!compassDone && (
            <div className="mt-5 rounded-2xl border-2 border-dashed border-gold/60 bg-gold-soft/50 p-4 text-sm">
              {t('dashboard.finishCompass')}{' '}
              <Link to="/compass" className="font-semibold text-gold-deep underline">
                {t('dashboard.startCompass')} →
              </Link>
            </div>
          )}

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {model.order.map((p, idx) => {
              const a = ACCENT[p];
              return (
                <section key={p} className={cn('rounded-2xl border-2 bg-card p-5', a.border)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('inline-grid size-10 place-items-center rounded-xl', a.soft)}>
                      {p === 'career' && <Briefcase className={cn('size-5', a.text)} aria-hidden />}
                      {p === 'college' && <GraduationCap className={cn('size-5', a.text)} aria-hidden />}
                      {p === 'sports' && <Trophy className={cn('size-5', a.text)} aria-hidden />}
                    </span>
                    {fitBadge(model.fit[p])}
                  </div>
                  <h2 className="mt-3 font-display text-lg font-bold tracking-tight">
                    {p === 'career' ? t('pathways.career') : p === 'college' ? t('pathways.college') : t('pathways.sports')}
                  </h2>
                  {p === 'career' && model.urgent && idx === 0 && (
                    <p className={cn('mt-2 rounded-xl p-3 text-xs leading-relaxed', a.soft)}>
                      {t('results.urgentNote')}
                    </p>
                  )}
                  {model.why[p].length > 0 && (
                    <p className="mt-2 text-xs italic text-muted-foreground">
                      {t('results.because', { reasons: model.why[p].join(` ${t('results.and')} `) })}
                    </p>
                  )}

                  {p === 'career' && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('results.suggestCareers')}
                      </p>
                      <ul className="mt-2 space-y-2.5">
                        {model.careerSug.map((car) => {
                          const saved = savedCareers.some((x) => x.career_id === car.career_id);
                          return (
                            <li key={car.career_id} className="rounded-xl border p-3">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold">{lang === 'es' ? car.title_es : car.title_en}</p>
                                <button
                                  type="button"
                                  className={cn('min-touch rounded-full p-1.5', saved ? 'text-gold-deep' : 'text-muted-foreground')}
                                  {...({ 'aria-label': t('app.save') } as const)}
                                  onClick={() => void toggleCareer(car.career_id)}
                                >
                                  <Bookmark className={cn('size-4', saved && 'fill-current')} />
                                </button>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {t('results.weeksPaycheck', { weeks: car.weeks_to_first_paycheck })} ·{' '}
                                {t('results.payRgv', { pay: car.starting_pay_rgv_hourly })}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {p === 'college' && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('results.suggestColleges')}
                      </p>
                      <ul className="mt-2 space-y-2.5">
                        {model.collegeSug.map((col) => {
                          const saved = savedColleges.some((x) => x.college_id === col.college_id);
                          return (
                            <li key={col.college_id} className="rounded-xl border p-3">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold">{col.name}</p>
                                <button
                                  type="button"
                                  className={cn('min-touch rounded-full p-1.5', saved ? 'text-gold-deep' : 'text-muted-foreground')}
                                  {...({ 'aria-label': t('app.save') } as const)}
                                  onClick={() => void toggleCollege(col.college_id)}
                                >
                                  <Bookmark className={cn('size-4', saved && 'fill-current')} />
                                </button>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {col.city}, {col.state_or_region} · {col.country}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {p === 'sports' && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('results.suggestSports')}
                      </p>
                      <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm">
                        <li>{t('sports.sug1')}</li>
                        <li>{t('sports.sug2')}</li>
                        <li>{t('sports.sug3')}</li>
                      </ul>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {/* Combined plan example */}
          <section className="mt-6 rounded-2xl border-2 border-gold/60 bg-gold-soft/50 p-5">
            <div className="flex items-center gap-2">
              <Layers className="size-5 text-gold-deep" aria-hidden />
              <h2 className="font-display text-lg font-bold tracking-tight">{t('results.combinedTitle')}</h2>
            </div>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-xl bg-card p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gold-deep">{t('results.combinedNow')}</p>
                <p className="mt-1">{t('results.combinedNowBody')}</p>
              </div>
              <div className="rounded-xl bg-card p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gold-deep">{t('results.combinedLater')}</p>
                <p className="mt-1">{t('results.combinedLaterBody')}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{t('results.combinedBody')}</p>
          </section>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button className="min-touch rounded-full" onClick={() => navigate('/')}>
              {t('results.goHome')}
            </Button>
            <Button variant="outline" className="min-touch rounded-full" onClick={() => navigate('/compass')}>
              {t('results.redo')}
            </Button>
          </div>
        </div>
      )}
    </QueryBoundary>
  );
}

/** Interest → career sector mapping (mirrors the mock catalog's map). */
const CAREER_SECTORS: Record<string, string[]> = {
  hands_on: ['trades', 'manufacturing', 'transportation'],
  building: ['trades', 'manufacturing'],
  tech: ['technology', 'manufacturing'],
  health: ['healthcare'],
  helping_people: ['healthcare', 'education', 'public_service'],
  business: ['business', 'technology'],
  outdoors: ['trades', 'agriculture'],
  art: ['design', 'trades'],
  sports: ['public_service', 'education'],
};
