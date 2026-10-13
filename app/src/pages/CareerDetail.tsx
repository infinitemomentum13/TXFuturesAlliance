/**
 * Career detail — everything a student needs to decide: what the work is
 * like, credential + issuer, training length/cost/funding, age rules, time
 * to first paycheck, RGV vs Texas pay, career ladder, local providers,
 * partner employers hiring, and the 5-step "My Plan" (enroll → train →
 * test → certified → apply) that can be pushed to the dashboard timeline.
 * Includes the "Talk to my counselor" action.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useI18n } from '@/i18n';
import { getSession } from '@/api/auth';
import {
  createCareerPlan,
  createCounselorRequest,
  getCareer,
  getCareerEmployers,
  getCareerPlanPreview,
  getCareerPlans,
  getSavedCareers,
  getStudent,
  saveCareer,
  unsaveCareer,
} from '@/api';
import type {
  AppStudent,
  Career,
  CareerPlanStep,
  CorporatePartner,
} from '@/api/types';
import { QueryBoundary } from '@/components/QueryBoundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  Building2,
  CheckCircle2,
  Clock,
  ListChecks,
  MapPin,
  MessageSquare,
  PiggyBank,
  TrendingUp,
} from 'lucide-react';
import { ACCENT } from './pathwayAccents';
import { cn } from '@/lib/utils';
import { fmtDate, studentAge } from './Career';

export default function CareerDetail() {
  const { t, lang } = useI18n();
  const { careerId } = useParams<{ careerId: string }>();
  const studentId = getSession()?.user.student_id;

  const [career, setCareer] = useState<Career | null>(null);
  const [employers, setEmployers] = useState<CorporatePartner[]>([]);
  const [steps, setSteps] = useState<CareerPlanStep[]>([]);
  const [student, setStudent] = useState<AppStudent | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [planned, setPlanned] = useState(false);
  const [justPlanned, setJustPlanned] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [counselorOpen, setCounselorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(() => {
    if (!careerId || !studentId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      getCareer(careerId),
      getCareerEmployers(careerId),
      getCareerPlanPreview(careerId),
      getStudent(studentId),
      getSavedCareers(studentId),
      getCareerPlans(studentId),
    ])
      .then(([c, emp, plan, stu, saved, plans]) => {
        setCareer(c);
        setEmployers(emp.data);
        setSteps(plan.steps);
        setStudent(stu);
        setSavedId(saved.data.find((x) => x.career_id === c.career_id)?.saved_id ?? null);
        setPlanned(plans.data.some((x) => x.career_id === c.career_id));
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [careerId, studentId]);

  useEffect(load, [load]);

  const age = useMemo(() => (student ? studentAge(student.date_of_birth) : null), [student]);

  const toggleSave = async () => {
    if (!career || !studentId) return;
    if (savedId) {
      await unsaveCareer(studentId, savedId);
      setSavedId(null);
    } else {
      const row = await saveCareer(studentId, career.career_id);
      setSavedId(row.saved_id);
    }
  };

  const addToPlan = async () => {
    if (!career || !studentId) return;
    setPlanBusy(true);
    try {
      await createCareerPlan(studentId, career.career_id);
      setPlanned(true);
      setJustPlanned(true);
    } catch (e) {
      if ((e as { code?: string })?.code === 'ALREADY_PLANNED') setPlanned(true);
    } finally {
      setPlanBusy(false);
    }
  };

  const title = career ? (lang === 'es' ? career.title_es : career.title_en) : '';
  const summary = career ? (lang === 'es' ? career.summary_es : career.summary_en) : '';

  return (
    <QueryBoundary loading={loading} error={error} onRetry={load}>
      {career && (
        <div className="space-y-6">
          {/* Breadcrumb + header */}
          <div>
            <Link
              to="/career"
              className={cn('inline-flex items-center gap-1 text-sm font-semibold', ACCENT.career.text)}
            >
              <ArrowLeft className="size-4" aria-hidden />
              {t('careerPage.backToCareers')}
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
              <Badge variant="outline" className="border-gold/60 text-gold-deep">
                {t('careerPage.sampleBadge')}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {career.rgv_sectors.map((s) => (
                <Badge key={s} variant="secondary" className="text-[11px]">
                  {t(`sectors.${s}`)}
                </Badge>
              ))}
            </div>
          </div>

          {/* Age warnings — never mislead a 16-year-old */}
          {age != null && (age < career.min_age_train || age < career.min_age_work) && (
            <div className="space-y-2">
              {age < career.min_age_train && (
                <p className="flex items-start gap-2 rounded-xl border-2 border-amber-400 bg-amber-50 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                  {t('careerPage.tooYoungTrain', { age: career.min_age_train })}
                </p>
              )}
              {age >= career.min_age_train && age < career.min_age_work && (
                <p className="flex items-start gap-2 rounded-xl border-2 border-amber-400 bg-amber-50 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                  {t('careerPage.tooYoungWork', { age: career.min_age_work })}
                </p>
              )}
            </div>
          )}

          {/* Headline stats */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Clock className="size-5 text-career" aria-hidden />}
              label={t('careerPage.firstPaycheck', { weeks: career.weeks_to_first_paycheck })}
              value={t('careerPage.weeksUnit', { weeks: career.training_length_weeks })}
              sublabel={t('careerPage.training')}
            />
            <StatCard
              icon={<TrendingUp className="size-5 text-career" aria-hidden />}
              label={`$${career.starting_pay_rgv_hourly}${t('careerPage.perHour')}`}
              sublabel={t('careerPage.rgvPay')}
              value={`$${career.starting_pay_tx_hourly}${t('careerPage.perHour')}`}
              sublabel2={t('careerPage.txPay')}
            />
            <StatCard
              icon={<PiggyBank className="size-5 text-career" aria-hidden />}
              label={`$${career.training_cost_usd.toLocaleString('en-US')}`}
              sublabel={t('careerPage.cost')}
              value={career.funded_options.length > 0 ? t('careerPage.fundedTag') : '—'}
            />
            <StatCard
              icon={<BadgeCheck className="size-5 text-career" aria-hidden />}
              label={t('careerPage.trainAt', { age: career.min_age_train })}
              sublabel={t('careerPage.workAt', { age: career.min_age_work })}
            />
          </div>

          {/* About + credential */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border-2 border-border bg-card p-5">
              <h2 className="font-display text-lg font-bold">{t('careerPage.whatLike')}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{summary}</p>
              {(lang === 'es' ? career.sport_schedule_note_es : career.sport_schedule_note_en) && (
                <p className="mt-3 rounded-xl bg-sports-soft px-3 py-2 text-xs">
                  {lang === 'es' ? career.sport_schedule_note_es : career.sport_schedule_note_en}
                </p>
              )}
            </div>
            <div className="rounded-2xl border-2 border-border bg-card p-5">
              <h2 className="font-display text-lg font-bold">{t('careerPage.credential')}</h2>
              <p className="mt-2 text-sm font-semibold">{career.credential}</p>
              <p className="text-sm text-muted-foreground">
                {t('careerPage.issuedBy', { issuer: career.credential_issuer })}
              </p>
              <h3 className="mt-4 text-sm font-bold">{t('careerPage.agesTitle')}</h3>
              <div className="mt-1 flex gap-2">
                <Badge variant="outline">{t('careerPage.trainAt', { age: career.min_age_train })}</Badge>
                <Badge variant="outline">{t('careerPage.workAt', { age: career.min_age_work })}</Badge>
              </div>
              {(lang === 'es' ? career.age_note_es : career.age_note_en) && (
                <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {lang === 'es' ? career.age_note_es : career.age_note_en}
                </p>
              )}
            </div>
          </section>

          {/* Funding */}
          {career.funded_options.length > 0 && (
            <section className={cn('rounded-2xl border-2 p-5', ACCENT.career.border, ACCENT.career.soft)}>
              <h2 className="font-display text-lg font-bold">{t('careerPage.fundingTitle')}</h2>
              <ul className="mt-2 space-y-1.5">
                {career.funded_options.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-career" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Ladder */}
          <section className="rounded-2xl border-2 border-border bg-card p-5">
            <h2 className="font-display text-lg font-bold">{t('careerPage.ladderTitle')}</h2>
            <ol className="mt-3 flex flex-wrap items-center gap-2">
              {career.career_ladder.map((rung, i) => (
                <li key={rung} className="flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-semibold',
                      i === 0 ? 'bg-career text-white' : 'bg-muted',
                    )}
                  >
                    {rung}
                  </span>
                  {i < career.career_ladder.length - 1 && (
                    <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                  )}
                </li>
              ))}
            </ol>
          </section>

          {/* Providers + employers */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border-2 border-border bg-card p-5">
              <h2 className="font-display text-lg font-bold">{t('careerPage.providersTitle')}</h2>
              <ul className="mt-3 space-y-3">
                {career.training_providers.map((p) => (
                  <li key={p.name} className="rounded-xl border p-3">
                    <p className="text-sm font-semibold">{p.name}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="text-[10px]">
                        {t(`providerTypes.${p.type}`)}
                      </Badge>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" aria-hidden />
                        {p.location}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-border bg-card p-5">
              <h2 className="font-display text-lg font-bold">{t('careerPage.employersTitle')}</h2>
              {employers.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">{t('careerPage.noEmployers')}</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {employers.map((e) => (
                    <li key={e.partner_id} className="flex items-start gap-3 rounded-xl border p-3">
                      <Building2 className="mt-0.5 size-5 shrink-0 text-career" aria-hidden />
                      <div>
                        <p className="text-sm font-semibold">{e.company_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.industry_sector} · {e.rgv_location}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* My Plan steps */}
          <section className="rounded-2xl border-2 border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <ListChecks className="size-5 text-career" aria-hidden />
              {t('careerPage.myPlanTitle')}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{t('careerPage.myPlanNote')}</p>
            <ol className="mt-4 space-y-4">
              {steps.map((st, i) => (
                <li key={st.step_key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-career text-sm font-bold text-white">
                      {i + 1}
                    </span>
                    {i < steps.length - 1 && <span className="mt-1 w-0.5 flex-1 bg-career/30" />}
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{lang === 'es' ? st.title_es : st.title_en}</p>
                      <Badge variant="secondary" className="text-[10px]">
                        {fmtDate(st.target_date, lang)}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {t('careerPage.stepCost')}: {st.est_cost_usd === 0 ? t('careerPage.stepFree') : `$${st.est_cost_usd}`}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {lang === 'es' ? st.detail_es : st.detail_en}
                    </p>
                    {(lang === 'es' ? st.documents_es : st.documents_en).length > 0 && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        <strong>{t('careerPage.docsNeeded')}:</strong>{' '}
                        {(lang === 'es' ? st.documents_es : st.documents_en).join(' · ')}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {justPlanned && (
              <p className="mt-3 rounded-xl bg-career-soft p-3 text-sm font-medium">
                {t('careerPage.addedToPlan')} — <Link to="/" className="underline">{t('nav.home')}</Link>
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                className="rounded-full bg-career text-white hover:bg-career/90"
                disabled={planBusy || planned}
                onClick={() => void addToPlan()}
              >
                {planned ? t('careerPage.alreadyPlanned') : t('careerPage.addToPlan')}
              </Button>
              <Button variant="outline" className="rounded-full" onClick={() => void toggleSave()}>
                {savedId ? <BookmarkCheck className="size-4 text-career" aria-hidden /> : <Bookmark className="size-4" aria-hidden />}
                {t(savedId ? 'careerPage.saved' : 'careerPage.save')}
              </Button>
              <Button
                variant="outline"
                className="rounded-full border-gold/60 text-gold-deep"
                onClick={() => setCounselorOpen(true)}
              >
                <MessageSquare className="size-4" aria-hidden />
                {t('careerPage.talkCounselor')}
              </Button>
            </div>
          </section>

          <CounselorDialog
            open={counselorOpen}
            career={career}
            studentId={studentId}
            onClose={() => setCounselorOpen(false)}
          />
        </div>
      )}
    </QueryBoundary>
  );
}

function StatCard({
  icon,
  label,
  sublabel,
  value,
  sublabel2,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  value?: string;
  sublabel2?: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4">
      <div className="flex items-center gap-2">
        {icon}
        <p className="font-display text-base font-extrabold leading-tight">{label}</p>
      </div>
      {sublabel && <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>}
      {value && <p className="mt-2 text-sm font-semibold">{value}</p>}
      {sublabel2 && <p className="text-xs text-muted-foreground">{sublabel2}</p>}
    </div>
  );
}

function CounselorDialog({
  open,
  career,
  studentId,
  onClose,
}: {
  open: boolean;
  career: Career;
  studentId?: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (open) {
      setBody('');
      setSent(false);
    }
  }, [open]);

  const send = async () => {
    if (!studentId) return;
    setBusy(true);
    try {
      await createCounselorRequest(studentId, {
        topic: 'career',
        career_id: career.career_id,
        body: body.trim(),
      });
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('careerPage.counselorTitle')}</DialogTitle>
          <DialogDescription>{t('careerPage.counselorHint')}</DialogDescription>
        </DialogHeader>
        {sent ? (
          <div className="space-y-4">
            <p className="rounded-xl bg-career-soft p-4 text-sm font-medium">{t('careerPage.counselorSent')}</p>
            <DialogFooter>
              <Button onClick={onClose} className="rounded-full">{t('app.close')}</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t('careerPage.counselorPh')}
              rows={4}
            />
            <DialogFooter>
              <Button variant="outline" onClick={onClose} className="rounded-full">
                {t('app.cancel')}
              </Button>
              <Button
                onClick={() => void send()}
                disabled={busy || !body.trim()}
                className="rounded-full bg-career text-white hover:bg-career/90"
              >
                {t('careerPage.counselorSend')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
