/**
 * Pathway Compass — first-run intake. One question per screen, progress bar,
 * every question skippable, EN/ES. On finish: saves the Compass answers,
 * updates grade/school on the student record, creates a sports profile if
 * one was described, and registers a report-card document if one was picked.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/i18n';
import { getSession } from '@/api/auth';
import {
  addDocument,
  createAthleticProfile,
  getAthleticProfiles,
  getStudent,
  listSchools,
  updateCompass,
  updateStudent,
} from '@/api';
import type {
  AppStudent,
  GpaRange,
  IncomeUrgency,
  InterestKey,
  OpenTo,
  SportLevel,
} from '@/api/types';
import { QueryBoundary } from '@/components/QueryBoundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Sparkles, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

const INTEREST_KEYS: InterestKey[] = [
  'hands_on', 'helping_people', 'tech', 'building', 'outdoors', 'business', 'health', 'art', 'sports',
];
const INCOME_KEYS: IncomeUrgency[] = ['right_away', 'within_a_year', 'after_high_school', 'not_a_pressure'];
const INCOME_I18N: Record<IncomeUrgency, string> = {
  right_away: 'compass.incomeRightAway',
  within_a_year: 'compass.incomeWithinYear',
  after_high_school: 'compass.incomeAfterHS',
  not_a_pressure: 'compass.incomeNoPressure',
};
const GPA_KEYS: GpaRange[] = ['under_2', '2_to_3', '3_to_35', '35_plus'];
const GPA_I18N: Record<GpaRange, string> = {
  under_2: 'compass.gpaUnder2',
  '2_to_3': 'compass.gpa2to3',
  '3_to_35': 'compass.gpa3to35',
  '35_plus': 'compass.gpa35plus',
};
const OPEN_TO_KEYS: OpenTo[] = ['rgv', 'texas', 'us', 'mexico', 'spain', 'other_country'];
const OPEN_TO_I18N: Record<OpenTo, string> = {
  rgv: 'compass.openRgv',
  texas: 'compass.openTexas',
  us: 'compass.openUs',
  mexico: 'compass.openMexico',
  spain: 'compass.openSpain',
  other_country: 'compass.openOther',
};
const LEVEL_I18N: Record<SportLevel, string> = {
  school: 'compass.levelSchool',
  club: 'compass.levelClub',
  fcb_academy: 'compass.levelAcademy',
};

const TOTAL_STEPS = 7;

export default function Compass() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const studentId = getSession()?.user.student_id;

  const [student, setStudent] = useState<AppStudent | null>(null);
  const [schools, setSchools] = useState<string[]>([]);
  const [hasAthletic, setHasAthletic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);

  /* answers */
  const [grade, setGrade] = useState<number | null>(null);
  const [school, setSchool] = useState('');
  const [income, setIncome] = useState<IncomeUrgency | null>(null);
  const [interests, setInterests] = useState<InterestKey[]>([]);
  const [plays, setPlays] = useState<boolean | null>(null);
  const [position, setPosition] = useState('');
  const [level, setLevel] = useState<SportLevel | null>(null);
  const [gradesKind, setGradesKind] = useState<'gpa_range' | 'report_card' | 'unknown' | null>(null);
  const [gpaRange, setGpaRange] = useState<GpaRange | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [openTo, setOpenTo] = useState<OpenTo[]>([]);
  const [firstGenSel, setFirstGenSel] = useState<'yes' | 'no' | 'na' | null>(null);

  const load = () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    Promise.all([getStudent(studentId), listSchools(), getAthleticProfiles(studentId)])
      .then(([s, schoolList, athletic]) => {
        setStudent(s);
        setSchools(schoolList.data.map((x) => x.name));
        setHasAthletic(athletic.data.length > 0);
        // Prefill from existing answers (a Compass can be resumed/redone).
        setGrade(s.current_grade_level ?? null);
        setSchool(s.school_name ?? '');
        const c = s.pathway_compass;
        if (c) {
          setIncome(c.income_urgency ?? null);
          setInterests(c.interests ?? []);
          setOpenTo(c.open_to ?? []);
          setFirstGenSel(c.first_generation === true ? 'yes' : c.first_generation === false ? 'no' : null);
          if (c.sport) {
            setPlays(c.sport.plays);
            setPosition(c.sport.position ?? '');
            setLevel(c.sport.level ?? null);
          }
          if (c.grades) {
            setGradesKind(c.grades.kind);
            setGpaRange(c.grades.gpa_range ?? null);
            setFileName(c.grades.report_card_file_name ?? null);
          }
        }
      })
      .catch(setError)
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [studentId]);

  const toggle = <K,>(list: K[], key: K, set: (v: K[]) => void) =>
    set(list.includes(key) ? list.filter((x) => x !== key) : [...list, key]);

  const finish = async () => {
    if (!studentId || saving) return;
    setSaving(true);
    try {
      await updateCompass(studentId, {
        completed: true,
        income_urgency: income,
        interests,
        open_to: openTo,
        first_generation: firstGenSel === 'yes' ? true : firstGenSel === 'no' ? false : null,
        sport: plays ? { plays: true, sport: 'Soccer', position: position || null, level } : { plays: false },
        grades: gradesKind
          ? { kind: gradesKind, gpa_range: gpaRange, report_card_file_name: fileName }
          : null,
      });
      await updateStudent(studentId, {
        current_grade_level: grade,
        school_name: school || null,
      } as Partial<AppStudent>);
      if (plays && !hasAthletic) {
        await createAthleticProfile(studentId, {
          sport: 'Soccer',
          position: position || null,
          competitive_level:
            level === 'fcb_academy' ? 'Academy' : level === 'club' ? 'Select' : 'Recreational',
          team_name: level === 'fcb_academy' ? 'FC Brownsville academy (sample)' : null,
        });
      }
      if (gradesKind === 'report_card' && fileName) {
        await addDocument(studentId, { kind: 'report_card', file_name: fileName });
      }
      navigate('/compass/results');
    } catch (e) {
      setError(e);
      setSaving(false);
    }
  };

  const choiceCard = (selected: boolean) =>
    cn(
      'min-touch w-full rounded-2xl border-2 bg-card px-4 py-3.5 text-left text-sm font-medium transition-colors',
      selected ? 'border-gold bg-gold-soft' : 'border-border hover:border-gold/60',
    );

  const stepBody = useMemo(() => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-bold tracking-tight">{t('compass.q1Title')}</h2>
            <div>
              <Label htmlFor="cmp-grade">{t('compass.q1Grade')}</Label>
              <select
                id="cmp-grade"
                className="mt-1.5 min-touch w-full rounded-xl border bg-card px-3 text-sm"
                value={grade ?? ''}
                onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">—</option>
                {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="cmp-school">{t('compass.q1School')}</Label>
              <select
                id="cmp-school"
                className="mt-1.5 min-touch w-full rounded-xl border bg-card px-3 text-sm"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
              >
                <option value="">—</option>
                {schools.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value="__other">{t('compass.q1SchoolOther')}</option>
              </select>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">{t('compass.q2Title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('compass.q2Hint')}</p>
            </div>
            <div className="space-y-2.5">
              {INCOME_KEYS.map((k) => (
                <button key={k} type="button" className={choiceCard(income === k)} onClick={() => setIncome(k)}>
                  {t(INCOME_I18N[k])}
                </button>
              ))}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">{t('compass.q3Title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('compass.q3Hint')}</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {INTEREST_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={cn(
                    'min-touch rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors',
                    interests.includes(k) ? 'border-gold bg-gold-soft' : 'border-border hover:border-gold/60',
                  )}
                  onClick={() => toggle(interests, k, setInterests)}
                >
                  {t(`interests.${k}`)}
                </button>
              ))}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-bold tracking-tight">{t('compass.q4Title')}</h2>
            <div className="flex gap-2.5">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  className={cn(choiceCard(plays === v), 'w-auto flex-1 text-center')}
                  onClick={() => setPlays(v)}
                >
                  {v ? t('compass.q4Yes') : t('compass.q4No')}
                </button>
              ))}
            </div>
            {plays && (
              <div className="space-y-3 rounded-2xl border bg-card p-4">
                <div>
                  <Label htmlFor="cmp-pos">{t('compass.q4Position')}</Label>
                  <Input
                    id="cmp-pos"
                    className="mt-1.5 min-touch"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder={t('compass.q4Position')}
                  />
                </div>
                <div>
                  <Label>{t('compass.q4Level')}</Label>
                  <div className="mt-1.5 space-y-2">
                    {(Object.keys(LEVEL_I18N) as SportLevel[]).map((l) => (
                      <button key={l} type="button" className={choiceCard(level === l)} onClick={() => setLevel(l)}>
                        {t(LEVEL_I18N[l])}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-bold tracking-tight">{t('compass.q5Title')}</h2>
            <div className="space-y-2.5">
              <button
                type="button"
                className={choiceCard(gradesKind === 'gpa_range')}
                onClick={() => setGradesKind('gpa_range')}
              >
                {t('compass.q5Gpa')}
              </button>
              {gradesKind === 'gpa_range' && (
                <div className="ml-3 space-y-2 border-l-2 border-gold/50 pl-3">
                  {GPA_KEYS.map((k) => (
                    <button key={k} type="button" className={choiceCard(gpaRange === k)} onClick={() => setGpaRange(k)}>
                      {t(GPA_I18N[k])}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                className={choiceCard(gradesKind === 'report_card')}
                onClick={() => setGradesKind('report_card')}
              >
                <Upload className="mr-2 inline size-4 align-[-2px]" aria-hidden />
                {t('compass.q5Upload')}
              </button>
              {gradesKind === 'report_card' && (
                <div className="ml-3 border-l-2 border-gold/50 pl-3">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="w-full text-sm"
                    onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                  />
                  {fileName && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('compass.filePicked', { name: fileName })}
                    </p>
                  )}
                </div>
              )}
              <button
                type="button"
                className={choiceCard(gradesKind === 'unknown')}
                onClick={() => setGradesKind('unknown')}
              >
                {t('compass.q5Unknown')}
              </button>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-bold tracking-tight">{t('compass.q6Title')}</h2>
            <div className="space-y-2.5">
              {OPEN_TO_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={choiceCard(openTo.includes(k))}
                  onClick={() => toggle(openTo, k, setOpenTo)}
                >
                  {t(OPEN_TO_I18N[k])}
                </button>
              ))}
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">{t('compass.q7Title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('compass.q7Hint')}</p>
            </div>
            <div className="space-y-2.5">
              <button type="button" className={choiceCard(firstGenSel === 'yes')} onClick={() => setFirstGenSel('yes')}>
                {t('compass.yes')}
              </button>
              <button type="button" className={choiceCard(firstGenSel === 'no')} onClick={() => setFirstGenSel('no')}>
                {t('compass.no')}
              </button>
              <button type="button" className={choiceCard(firstGenSel === 'na')} onClick={() => setFirstGenSel('na')}>
                {t('compass.preferNot')}
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, grade, school, income, interests, plays, position, level, gradesKind, gpaRange, fileName, openTo, firstGenSel, schools, t]);

  // Explorers (under 13) don't take the Compass — their parent does it with them later.
  useEffect(() => {
    if (student?.app_mode === 'explorer') navigate('/', { replace: true });
  }, [student, navigate]);
  if (student?.app_mode === 'explorer') return null;

  return (
    <QueryBoundary loading={loading} error={error} onRetry={load}>
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold-deep">
          <Sparkles className="size-4" aria-hidden />
          {t('compass.title')}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t('compass.subtitle')}</p>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('compass.stepOf', { current: step + 1, total: TOTAL_STEPS })}</span>
          </div>
          <Progress value={((step + 1) / TOTAL_STEPS) * 100} className="mt-2 h-2" />
        </div>

        <div className="mt-8">{stepBody}</div>

        <div className="mt-10 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            className="min-touch rounded-full"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t('app.back')}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="min-touch rounded-full"
              onClick={() => (step === TOTAL_STEPS - 1 ? void finish() : setStep((s) => s + 1))}
            >
              {t('app.skip')}
            </Button>
            <Button
              className="min-touch rounded-full"
              disabled={saving}
              onClick={() => (step === TOTAL_STEPS - 1 ? void finish() : setStep((s) => s + 1))}
            >
              {saving
                ? t('compass.saving')
                : step === TOTAL_STEPS - 1
                  ? t('compass.finish')
                  : t('app.next')}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </QueryBoundary>
  );
}
