/**
 * Talent Insights — FC Brownsville club staff ONLY (Prompt 6B).
 *
 * Decision support for coaches, never an automatic ranking. Shows only
 * players registered with FC Brownsville (or tryout attendees) whose parent
 * (or the player, if 18+) turned on "Use my player data for club player
 * development" in the Consent Center. Nothing here is visible to players,
 * parents, partners or scouts; every view is written to the audit log.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/i18n';
import {
  addTryoutEvaluation,
  createPositionProfile,
  getHiddenGems,
  getPositionFits,
  getPositionProfiles,
  getTalentAudit,
  getTalentFairness,
  getTalentPlayers,
  getTalentTimeline,
  getTryoutPlayers,
  updatePositionProfile,
} from '@/api';
import { getSession } from '@/api/auth';
import type {
  DevelopmentPoint,
  FairnessReport,
  HiddenGem,
  PositionAttribute,
  PositionFit,
  PositionProfile,
  TalentPlayerSummary,
  TalentViewLogEntry,
  TryoutPlayer,
} from '@/api/types';
import { QueryBoundary } from '@/components/QueryBoundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ACCENT } from './pathwayAccents';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowDownWideNarrow,
  BadgeCheck,
  ClipboardList,
  Eye,
  Lock,
  Plus,
  Scale,
  ScrollText,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const A = ACCENT.sports;
const DIMS = ['technical', 'tactical', 'physical', 'mentality'] as const;
const DIM_COLORS = { technical: '#0E7C66', tactical: '#1D4ED8', physical: '#C9A961', mentality: '#9333EA' };
const ATTRS: PositionAttribute[] = [
  'technical', 'tactical', 'physical', 'mentality', 'speed', 'agility', 'endurance', 'strength',
];

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

export default function TalentPage() {
  const { t } = useI18n();
  const role = getSession()?.user.role;

  if (role !== 'club_staff') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Lock className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
        <h1 className="mt-4 font-display text-2xl font-extrabold">{t('talentPage.lockedTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('talentPage.lockedBody')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className={cn('h-7 w-7', A.text)} />
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{t('talentPage.title')}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t('talentPage.subtitle')}</p>
      </header>

      {/* Guardrails — on every screen, always visible */}
      <div className={cn('mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border px-4 py-3 text-sm', A.soft, A.border)}>
        <span className={cn('flex items-center gap-1.5 font-semibold', A.text)}>
          <Scale className="h-4 w-4" aria-hidden /> {t('talentPage.decisionSupport')}
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Lock className="h-4 w-4" aria-hidden /> {t('talentPage.clubOnly')}
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <ScrollText className="h-4 w-4" aria-hidden /> {t('talentPage.viewsLogged')}
        </span>
      </div>

      <Tabs defaultValue="board">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="board">{t('talentPage.tabBoard')}</TabsTrigger>
          <TabsTrigger value="compare">{t('talentPage.tabCompare')}</TabsTrigger>
          <TabsTrigger value="gems">{t('talentPage.tabGems')}</TabsTrigger>
          <TabsTrigger value="tryouts">{t('talentPage.tabTryouts')}</TabsTrigger>
          <TabsTrigger value="positions">{t('talentPage.tabPositions')}</TabsTrigger>
          <TabsTrigger value="fairness">{t('talentPage.tabFairness')}</TabsTrigger>
          <TabsTrigger value="audit">{t('talentPage.tabAudit')}</TabsTrigger>
        </TabsList>
        <TabsContent value="board"><BoardTab /></TabsContent>
        <TabsContent value="compare"><CompareTab /></TabsContent>
        <TabsContent value="gems"><GemsTab /></TabsContent>
        <TabsContent value="tryouts"><TryoutsTab /></TabsContent>
        <TabsContent value="positions"><PositionsTab /></TabsContent>
        <TabsContent value="fairness"><FairnessTab /></TabsContent>
        <TabsContent value="audit"><AuditTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------- shared bits -------------------------------- */

function QuarterChip({ q }: { q: 1 | 2 | 3 | 4 }) {
  const { t } = useI18n();
  return (
    <Badge variant="secondary" className="text-[10px]" title={t(`talentPage.q${q}Hint`)}>
      {t(`talentPage.q${q}`)}
    </Badge>
  );
}

function LevelBadge({ level }: { level: string | null }) {
  const { t } = useI18n();
  if (!level) return <>—</>;
  const key = level === 'Academy' ? 'academy' : level === 'Select' ? 'select' : 'recreational';
  return (
    <Badge variant={level === 'Academy' ? 'default' : 'secondary'} className="text-[10px]">
      {t(`talentPage.level.${key}`)}
    </Badge>
  );
}

function RateBadge({ rate }: { rate: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
        rate >= 0.25 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-muted text-muted-foreground',
      )}
    >
      <TrendingUp className="h-3 w-3" aria-hidden />
      {rate > 0 ? `+${rate.toFixed(1)}` : rate.toFixed(1)}/mo
    </span>
  );
}

/* --------------------- 1) Player Development Board --------------------- */

function BoardTab() {
  const { t } = useI18n();
  const [players, setPlayers] = useState<TalentPlayerSummary[]>([]);
  const [consentOff, setConsentOff] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [selected, setSelected] = useState<TalentPlayerSummary | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getTalentPlayers()
      .then((r) => { setPlayers(r.players); setConsentOff(r.consent_off_count); })
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="mt-4">
      <p className="mb-3 text-sm text-muted-foreground">
        {t('talentPage.boardHint')} · {t('talentPage.consentOff', { count: consentOff })}
      </p>
      <QueryBoundary loading={loading} error={error} onRetry={load}>
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-3">{t('talentPage.colPlayer')}</th>
                <th className="p-3">{t('talentPage.colBorn')}</th>
                <th className="p-3">{t('talentPage.colLevel')}</th>
                <th className="p-3">{t('talentPage.colRate')}</th>
                <th className="p-3">{t('talentPage.colTeam')}</th>
                <th className="p-3">{t('talentPage.colMinutes')}</th>
                <th className="p-3">{t('talentPage.colAttendance')}</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr
                  key={p.student_id}
                  className="cursor-pointer border-b last:border-0 hover:bg-muted/50"
                  onClick={() => setSelected(p)}
                >
                  <td className="p-3">
                    <p className="font-medium">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-muted-foreground">{p.primary_position ?? '—'}</p>
                  </td>
                  <td className="p-3">
                    <span className="mr-1">{p.birth_year}</span>
                    <QuarterChip q={p.birth_quarter} />
                  </td>
                  <td className="p-3 font-semibold">{p.current_level.toFixed(1)}</td>
                  <td className="p-3"><RateBadge rate={p.improvement_rate} /></td>
                  <td className="p-3"><LevelBadge level={p.team_level} /></td>
                  <td className="p-3">{p.minutes_pct != null ? `${p.minutes_pct}%` : '—'}</td>
                  <td className="p-3">{p.attendance_pct != null ? `${p.attendance_pct}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryBoundary>
      {selected && <PlayerTimelineDialog player={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function PlayerTimelineDialog({ player, onClose }: { player: TalentPlayerSummary; onClose: () => void }) {
  const { t, lang } = useI18n();
  const [points, setPoints] = useState<DevelopmentPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTalentTimeline(player.student_id)
      .then((r) => setPoints(r.points))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [player.student_id]);

  const data = points.map((p) => ({
    date: fmtDate(p.date, lang),
    technical: p.technical, tactical: p.tactical, physical: p.physical, mentality: p.mentality,
    source: p.source,
  }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{player.first_name} {player.last_name}</DialogTitle>
          <DialogDescription>
            {player.birth_year} · {t(`talentPage.q${player.birth_quarter}`)} · {player.primary_position ?? ''} · {t('talentPage.timelineHint')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className={cn('rounded-2xl border p-4 text-center', A.soft, A.border)}>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('talentPage.currentLevel')}</p>
            <p className="font-display text-3xl font-extrabold">{player.current_level.toFixed(1)}</p>
          </div>
          <div className={cn('rounded-2xl border p-4 text-center', A.soft, A.border)}>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('talentPage.improvementRate')}</p>
            <p className={cn('font-display text-3xl font-extrabold', A.text)}>
              {player.improvement_rate > 0 ? '+' : ''}{player.improvement_rate.toFixed(1)}
              <span className="text-sm font-medium text-muted-foreground">/mo</span>
            </p>
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">…</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {DIMS.map((d) => (
                  <Line key={d} type="monotone" dataKey={d} name={t(`talentPage.dim.${d}`)}
                    stroke={DIM_COLORS[d]} strokeWidth={2} dot={{ r: 2 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>{t('talentPage.colMinutes')}: {player.minutes_pct != null ? `${player.minutes_pct}%` : '—'}</span>
          <span>{t('talentPage.colAttendance')}: {player.attendance_pct != null ? `${player.attendance_pct}%` : '—'}</span>
          <span>{t('talentPage.ageAdjusted')}: {player.age_adjusted_level.toFixed(1)}</span>
        </div>
        <p className="text-xs text-muted-foreground">{t('talentPage.decisionSupport')}</p>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------- 2) Fair comparisons ------------------------- */

function CompareTab() {
  const { t } = useI18n();
  const [players, setPlayers] = useState<TalentPlayerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [year, setYear] = useState<string>('');
  const [adjusted, setAdjusted] = useState(true);
  const [lateFirst, setLateFirst] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getTalentPlayers()
      .then((r) => {
        setPlayers(r.players);
        const years = [...new Set(r.players.map((p) => p.birth_year))].sort();
        setYear((y) => y || String(years[0] ?? ''));
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const years = useMemo(() => [...new Set(players.map((p) => p.birth_year))].sort(), [players]);
  const rows = useMemo(() => {
    const inYear = players.filter((p) => String(p.birth_year) === year);
    const sorted = [...inYear].sort((a, b) => {
      if (lateFirst && a.birth_quarter !== b.birth_quarter) return b.birth_quarter - a.birth_quarter;
      const key = adjusted ? 'age_adjusted_level' : 'current_level';
      return b[key] - a[key];
    });
    return sorted;
  }, [players, year, adjusted, lateFirst]);

  return (
    <div className="mt-4">
      <p className="mb-3 text-sm text-muted-foreground">{t('talentPage.compareHint')}</p>
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <Label>{t('talentPage.birthYear')}</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="min-touch w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={adjusted} onCheckedChange={setAdjusted} />
          {t('talentPage.ageAdjustedView')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={lateFirst} onCheckedChange={setLateFirst} />
          <ArrowDownWideNarrow className="h-4 w-4" aria-hidden />
          {t('talentPage.lateBornFirst')}
        </label>
      </div>
      <QueryBoundary loading={loading} error={error} onRetry={load}>
        <div className="space-y-2">
          {rows.map((p) => {
            const v = adjusted ? p.age_adjusted_level : p.current_level;
            const max = Math.max(...rows.map((r) => (adjusted ? r.age_adjusted_level : r.current_level)), 1);
            return (
              <div key={p.student_id} className="rounded-2xl border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {p.first_name} {p.last_name}
                    <span className="ml-2 text-xs text-muted-foreground">{p.primary_position ?? ''}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <QuarterChip q={p.birth_quarter} />
                    <RateBadge rate={p.improvement_rate} />
                    <span className="w-10 text-right text-sm font-semibold">{v.toFixed(1)}</span>
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className={cn('h-full rounded-full', A.bg)} style={{ width: `${(v / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        {adjusted && <p className="mt-3 text-xs text-muted-foreground">{t('talentPage.adjustedNote')}</p>}
      </QueryBoundary>
    </div>
  );
}

/* --------------------------- 3) Hidden gems ---------------------------- */

function GemsTab() {
  const { t } = useI18n();
  const [gems, setGems] = useState<HiddenGem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(() => {
    setLoading(true);
    getHiddenGems()
      .then((r) => setGems(r.gems))
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="mt-4">
      <p className="mb-3 text-sm text-muted-foreground">{t('talentPage.gemsHint')}</p>
      <QueryBoundary loading={loading} error={error} onRetry={load} isEmpty={gems.length === 0}>
        <div className="grid gap-3 sm:grid-cols-2">
          {gems.map((g) => (
            <div key={g.student_id} className={cn('rounded-2xl border bg-card p-4 shadow-sm', A.border)}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{g.first_name} {g.last_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.birth_year} · {t(`talentPage.q${g.birth_quarter}`)} · {g.primary_position ?? '—'}
                  </p>
                </div>
                <Sparkles className={cn('h-5 w-5 shrink-0', A.text)} aria-hidden />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <RateBadge rate={g.improvement_rate} />
                <LevelBadge level={g.team_level} />
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {g.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <BadgeCheck className={cn('mt-0.5 h-4 w-4 shrink-0', A.text)} aria-hidden />
                    <span>{t(`talentPage.reason.${r.key}`, { ...r.params, dim: t(`talentPage.dim.${r.params.dim ?? 'technical'}`) })}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </QueryBoundary>
      <p className="mt-3 text-xs text-muted-foreground">{t('talentPage.decisionSupport')}</p>
    </div>
  );
}

/* -------------------------- 4) Tryout evaluation ------------------------ */

function TryoutsTab() {
  const { t, lang } = useI18n();
  const [players, setPlayers] = useState<TryoutPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [evalFor, setEvalFor] = useState<TryoutPlayer | null>(null);
  const [showRubric, setShowRubric] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getTryoutPlayers()
      .then((r) => setPlayers(r.players))
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('talentPage.tryoutsHint')}</p>
        <Button variant="outline" size="sm" className="min-touch rounded-full" onClick={() => setShowRubric((v) => !v)}>
          <ClipboardList className="h-4 w-4" /> {t('talentPage.rubricTitle')}
        </Button>
      </div>

      {showRubric && (
        <div className="mb-4 rounded-2xl border bg-card p-4 text-sm">
          {DIMS.map((d) => (
            <div key={d} className="mb-3 last:mb-0">
              <p className="font-semibold">{t(`talentPage.dim.${d}`)}</p>
              <div className="mt-1 grid gap-1 text-xs text-muted-foreground sm:grid-cols-5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <p key={s}><span className="font-semibold text-foreground">{s}</span> — {t(`talentPage.rubric.${d}.${s}`)}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <QueryBoundary loading={loading} error={error} onRetry={load}>
        <div className="space-y-3">
          {players.map((tp) => (
            <div key={tp.tryout_player_id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {tp.first_name} {tp.last_name}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {tp.birth_year} · {t(`talentPage.q${tp.birth_quarter}`)} · {t('talentPage.tryoutOn', { date: fmtDate(tp.tryout_date, lang) })}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {tp.needs_second_look && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" aria-hidden />
                      {t('talentPage.secondLook')}
                    </Badge>
                  )}
                  <Badge variant="secondary">{t('talentPage.evaluators', { count: tp.evaluations.length })}</Badge>
                  <Button size="sm" variant="outline" className="min-touch rounded-full" onClick={() => setEvalFor(tp)}>
                    <Plus className="h-4 w-4" /> {t('talentPage.addEvaluation')}
                  </Button>
                </div>
              </div>

              {/* Side-by-side evaluators */}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="py-1 pr-3">{t('talentPage.colEvaluator')}</th>
                      {DIMS.map((d) => (
                        <th key={d} className="py-1 pr-3">
                          {t(`talentPage.dim.${d}`)}
                          {tp.disagreement_dims.includes(d) && (
                            <AlertTriangle className="ml-1 inline h-3 w-3 text-destructive" aria-label={t('talentPage.disagree')} />
                          )}
                        </th>
                      ))}
                      <th className="py-1">{t('talentPage.colNotes')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tp.evaluations.map((e) => (
                      <tr key={e.evaluation_id} className="border-t">
                        <td className="py-1.5 pr-3 text-xs">{e.evaluator_name}</td>
                        {DIMS.map((d) => (
                          <td key={d} className={cn('py-1.5 pr-3 font-semibold', tp.disagreement_dims.includes(d) && 'text-destructive')}>
                            {e[d]}
                          </td>
                        ))}
                        <td className="py-1.5 text-xs text-muted-foreground">{e.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </QueryBoundary>
      {evalFor && (
        <EvaluationDialog
          player={evalFor}
          onClose={() => setEvalFor(null)}
          onSaved={(updated) => {
            setPlayers((prev) => prev.map((p) => (p.tryout_player_id === updated.tryout_player_id ? updated : p)));
            setEvalFor(null);
          }}
        />
      )}
    </div>
  );
}

function EvaluationDialog({
  player, onClose, onSaved,
}: { player: TryoutPlayer; onClose: () => void; onSaved: (p: TryoutPlayer) => void }) {
  const { t } = useI18n();
  const [scores, setScores] = useState<Record<(typeof DIMS)[number], number>>({ technical: 3, tactical: 3, physical: 3, mentality: 3 });
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('talentPage.evalTitle', { name: `${player.first_name} ${player.last_name}` })}</DialogTitle>
          <DialogDescription>{t('talentPage.evalHint')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {DIMS.map((d) => (
            <div key={d} className="flex items-center justify-between gap-3">
              <Label className="w-32 shrink-0">{t(`talentPage.dim.${d}`)}</Label>
              <Select
                value={String(scores[d])}
                onValueChange={(v) => setScores((prev) => ({ ...prev, [d]: Number(v) }))}
              >
                <SelectTrigger className="min-touch"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s} — {t(`talentPage.rubric.${d}.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          <div>
            <Label htmlFor="ev-notes">{t('talentPage.colNotes')}</Label>
            <Textarea id="ev-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="min-touch rounded-full" onClick={onClose}>{t('sportsPage.cancel')}</Button>
          <Button
            className={cn('min-touch rounded-full text-white', A.bg)}
            disabled={busy}
            onClick={() => {
              setBusy(true);
              addTryoutEvaluation(player.tryout_player_id, { ...scores, notes: notes.trim() || undefined })
                .then(onSaved)
                .catch(() => {})
                .finally(() => setBusy(false));
            }}
          >
            {t('talentPage.saveEvaluation')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------- 5) Position profiles ------------------------ */

function PositionsTab() {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState<PositionProfile[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [fits, setFits] = useState<PositionFit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [editing, setEditing] = useState<PositionProfile | 'new' | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getPositionProfiles()
      .then((r) => {
        setProfiles(r.profiles);
        setActiveId((id) => id || r.profiles[0]?.profile_id || '');
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    if (!activeId) return;
    getPositionFits(activeId).then((r) => setFits(r.fits)).catch(() => {});
  }, [activeId]);

  const active = profiles.find((p) => p.profile_id === activeId);

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('talentPage.positionsHint')}</p>
        <Button variant="outline" size="sm" className="min-touch rounded-full" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" /> {t('talentPage.newProfile')}
        </Button>
      </div>
      <QueryBoundary loading={loading} error={error} onRetry={load}>
        <div className="mb-4 flex flex-wrap gap-2">
          {profiles.map((p) => (
            <button
              key={p.profile_id}
              onClick={() => setActiveId(p.profile_id)}
              className={cn(
                'min-touch rounded-full border-2 px-4 py-2 text-sm font-medium',
                activeId === p.profile_id ? cn(A.border, A.soft, A.text) : 'border-border',
              )}
            >
              {p.position}
            </button>
          ))}
        </div>

        {active && (
          <div className="mb-4 rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{t('talentPage.whatMatters', { position: active.position })}</p>
              <Button variant="ghost" size="sm" className="min-touch" onClick={() => setEditing(active)}>
                {t('talentPage.editProfile')}
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[...active.attributes].sort((a, b) => b.weight - a.weight).map(({ attribute, weight }) => (
                <Badge key={attribute} variant={weight >= 4 ? 'default' : 'secondary'} className="gap-1">
                  {t(`talentPage.attr.${attribute}`)} · {weight}
                </Badge>
              ))}
            </div>
            {active.notes && <p className="mt-2 text-xs text-muted-foreground">{active.notes}</p>}
          </div>
        )}

        <div className="space-y-2">
          {fits.map((f) => (
            <div key={f.player.student_id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-3">
              <div>
                <p className="text-sm font-medium">
                  {f.player.first_name} {f.player.last_name}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {t('talentPage.playsNow', { position: f.player.primary_position ?? '—' })}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('talentPage.topMatches')}: {f.top_matches.map((m) => t(`talentPage.attr.${m}`)).join(' · ')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {f.plays_elsewhere && (
                  <Badge variant="secondary" className="gap-1">
                    <Eye className="h-3 w-3" aria-hidden /> {t('talentPage.playsElsewhere')}
                  </Badge>
                )}
                <span className={cn('rounded-full px-3 py-1 text-sm font-bold text-white', A.bg)}>{f.fit_score}</span>
              </div>
            </div>
          ))}
        </div>
      </QueryBoundary>
      {editing && (
        <ProfileDialog
          profile={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function ProfileDialog({
  profile, onClose, onSaved,
}: { profile: PositionProfile | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [position, setPosition] = useState(profile?.position ?? '');
  const [weights, setWeights] = useState<Record<PositionAttribute, number>>(() => {
    const init = Object.fromEntries(ATTRS.map((a) => [a, 0])) as Record<PositionAttribute, number>;
    profile?.attributes.forEach(({ attribute, weight }) => { init[attribute] = weight; });
    return init;
  });
  const [notes, setNotes] = useState(profile?.notes ?? '');
  const [busy, setBusy] = useState(false);

  const chosen = ATTRS.filter((a) => weights[a] > 0).map((a) => ({ attribute: a, weight: weights[a] }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{profile ? t('talentPage.editProfile') : t('talentPage.newProfile')}</DialogTitle>
          <DialogDescription>{t('talentPage.profileHint')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="pp-pos">{t('talentPage.colPosition')}</Label>
            <Input id="pp-pos" value={position} onChange={(e) => setPosition(e.target.value)} placeholder={t('talentPage.positionPh')} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ATTRS.map((a) => (
              <div key={a} className="flex items-center justify-between gap-2">
                <Label className="text-xs">{t(`talentPage.attr.${a}`)}</Label>
                <Select value={String(weights[a])} onValueChange={(v) => setWeights((p) => ({ ...p, [a]: Number(v) }))}>
                  <SelectTrigger className="min-touch w-16"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5].map((w) => (
                      <SelectItem key={w} value={String(w)}>{w === 0 ? '—' : w}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div>
            <Label htmlFor="pp-notes">{t('talentPage.colNotes')}</Label>
            <Textarea id="pp-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="min-touch rounded-full" onClick={onClose}>{t('sportsPage.cancel')}</Button>
          <Button
            className={cn('min-touch rounded-full text-white', A.bg)}
            disabled={busy || !position.trim() || chosen.length === 0}
            onClick={() => {
              setBusy(true);
              const payload = { position: position.trim(), attributes: chosen, notes: notes.trim() || undefined };
              (profile ? updatePositionProfile(profile.profile_id, payload) : createPositionProfile(payload))
                .then(onSaved)
                .catch(() => {})
                .finally(() => setBusy(false));
            }}
          >
            {t('talentPage.saveProfile')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------- 6) Fairness check ------------------------- */

function FairnessTab() {
  const { t } = useI18n();
  const [report, setReport] = useState<FairnessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(() => {
    setLoading(true);
    getTalentFairness()
      .then(setReport)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const label = (l: string) =>
    /^q[1-4]$/.test(l) ? t(`talentPage.${l}`) : l === 'boys' || l === 'girls' ? t(`talentPage.${l}`) : l;

  const Section = ({ title, groups }: { title: string; groups: FairnessReport['by_gender'] }) => {
    const maxRate = Math.max(...groups.map((g) => g.rate ?? 0), 0.01);
    return (
      <section className="rounded-2xl border bg-card p-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="mt-3 space-y-2">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="flex items-center justify-between text-sm">
                <span>{label(g.label)}</span>
                <span className="text-xs text-muted-foreground">
                  {t('talentPage.selectedOf', { selected: g.selected, pool: g.pool })}
                  {g.rate != null && <span className="ml-1 font-semibold text-foreground">{Math.round(g.rate * 100)}%</span>}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full', A.bg)} style={{ width: `${((g.rate ?? 0) / maxRate) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="mt-4">
      <p className="mb-3 text-sm text-muted-foreground">{t('talentPage.fairnessHint')}</p>
      <QueryBoundary loading={loading} error={error} onRetry={load}>
        {report && (
          <div className="grid gap-3 lg:grid-cols-3">
            <Section title={t('talentPage.byQuarter')} groups={report.by_birth_quarter} />
            <Section title={t('talentPage.byGender')} groups={report.by_gender} />
            <Section title={t('talentPage.byZip')} groups={report.by_zip} />
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{t(report?.selected_definition ?? 'talentPage.selectedDef')}</p>
      </QueryBoundary>
    </div>
  );
}

/* ------------------------------ 7) Audit log ---------------------------- */

function AuditTab() {
  const { t, lang } = useI18n();
  const [entries, setEntries] = useState<TalentViewLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(() => {
    setLoading(true);
    getTalentAudit()
      .then((r) => setEntries(r.entries))
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="mt-4">
      <p className="mb-3 text-sm text-muted-foreground">{t('talentPage.auditHint')}</p>
      <QueryBoundary loading={loading} error={error} onRetry={load} isEmpty={entries.length === 0}>
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-3">{t('talentPage.colViewer')}</th>
                <th className="p-3">{t('talentPage.colPlayer')}</th>
                <th className="p-3">{t('talentPage.colView')}</th>
                <th className="p-3">{t('talentPage.colWhen')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.log_id} className="border-b last:border-0">
                  <td className="p-3">{e.viewer_name}</td>
                  <td className="p-3">{e.player_name ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3 text-xs">{t(`talentPage.view.${e.view}`, {}) || e.view}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(e.viewed_at).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryBoundary>
    </div>
  );
}
