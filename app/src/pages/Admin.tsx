/**
 * Admin side — three tabs:
 *  1. Overview: demo-data controls + sample-data stats (from earlier builds)
 *  2. Outcomes: aggregate dashboard for grants/sponsors (never names),
 *     filters by school/grade/year, CSV export, printable one-page report
 *  3. Content: add/edit careers, schools, scholarships and opportunities,
 *     with "verified on [date] by [name]" and a re-verification flag after
 *     six months.
 */
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import {
  createContent,
  getOutcomes,
  listCareers,
  listColleges,
  listOpportunities,
  listStudents,
  resetDemoData,
  searchScholarships,
  updateContent,
  type ContentCollection,
} from '@/api';
import type { OutcomesReport } from '@/api/types';
import { needsReverification } from '@/lib/verification';
import { QueryBoundary } from '@/components/QueryBoundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Download,
  FileCog,
  LayoutDashboard,
  Printer,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const FORCE_ERRORS_KEY = 'txfa.forceErrors';

export default function Admin() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t('roles.adminHome')}</h1>
      <Tabs defaultValue="outcomes" className="mt-6">
        <TabsList className="print:hidden">
          <TabsTrigger value="outcomes">
            <BarChart3 className="mr-1 h-4 w-4" aria-hidden /> {t('adminPage.tabOutcomes')}
          </TabsTrigger>
          <TabsTrigger value="content">
            <FileCog className="mr-1 h-4 w-4" aria-hidden /> {t('adminPage.tabContent')}
          </TabsTrigger>
          <TabsTrigger value="demo">
            <LayoutDashboard className="mr-1 h-4 w-4" aria-hidden /> {t('adminPage.tabDemo')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="outcomes">
          <OutcomesTab />
        </TabsContent>
        <TabsContent value="content" className="print:hidden">
          <ContentTab />
        </TabsContent>
        <TabsContent value="demo" className="print:hidden">
          <DemoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* --------------------------- Outcomes tab ------------------------------ */

function fmtMoney(n: number): string {
  return `$${n.toLocaleString()}`;
}

function OutcomesTab() {
  const { t, lang } = useI18n();
  const [school, setSchool] = useState('');
  const [grade, setGrade] = useState('');
  const [year, setYear] = useState('');
  const [report, setReport] = useState<OutcomesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [printing, setPrinting] = useState(false);

  const load = useCallback((f: { school?: string; grade?: number; year?: number }) => {
    setLoading(true);
    getOutcomes(f)
      .then(setReport)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load({}), [load]);

  const apply = () =>
    load({
      school: school || undefined,
      grade: grade ? Number(grade) : undefined,
      year: year ? Number(year) : undefined,
    });

  const schools = ['Sample Middle School', 'Sample Early College HS', 'Sample High School', 'Sample Elementary', 'Sample CTE Academy'];
  const years = [2025, 2026];

  const exportCsv = () => {
    if (!report) return;
    const rows: Array<[string, string | number]> = [
      ['students_served', report.students_served],
      ['pathway_career', report.by_pathway.career],
      ['pathway_college', report.by_pathway.college],
      ['pathway_sports', report.by_pathway.sports],
      ['certificates_earned', report.certificates_earned],
      ['avg_weeks_to_first_job', report.avg_weeks_to_first_job ?? ''],
      ['scholarships_applied', report.scholarships.applied],
      ['scholarships_awarded', report.scholarships.awarded],
      ['scholarship_dollars', report.scholarships.dollars],
      ['college_enrollments', report.college_enrollments],
      ['athletes_recruited', report.athletes_recruited],
      ...report.placements_by_partner.map(
        (p): [string, string | number] => [`placements_${p.partner_name}`, p.placements],
      ),
    ];
    const csv = ['metric,value', ...rows.map(([k, v]) => `"${k}",${v}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'txfa-outcomes.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const printReport = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 100);
  };

  return (
    <div>
      {/* Filters */}
      <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-4 print:hidden">
        <div>
          <Label>{t('adminPage.fSchool')}</Label>
          <Select value={school} onValueChange={setSchool}>
            <SelectTrigger className="min-touch"><SelectValue placeholder={t('sportsPage.any')} /></SelectTrigger>
            <SelectContent>
              {schools.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t('adminPage.fGrade')}</Label>
          <Select value={grade} onValueChange={setGrade}>
            <SelectTrigger className="min-touch"><SelectValue placeholder={t('sportsPage.any')} /></SelectTrigger>
            <SelectContent>
              {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                <SelectItem key={g} value={String(g)}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t('adminPage.fYear')}</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="min-touch"><SelectValue placeholder={t('sportsPage.any')} /></SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button className="min-touch flex-1 rounded-full" onClick={apply}>{t('adminPage.apply')}</Button>
          <Button variant="outline" className="min-touch rounded-full" onClick={exportCsv} disabled={!report}>
            <Download className="h-4 w-4" aria-hidden /> CSV
          </Button>
          <Button variant="outline" className="min-touch rounded-full" onClick={printReport} disabled={!report}>
            <Printer className="h-4 w-4" aria-hidden /> {t('adminPage.print')}
          </Button>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground print:hidden">{t('adminPage.aggregateNote')}</p>

      <QueryBoundary loading={loading} error={error} onRetry={apply}>
        {report && (
          <div id="impact-report" className={cn('mt-4', printing && 'print-report')}>
            {/* Printable header */}
            <div className="mb-4 hidden text-center print:block">
              <h2 className="font-display text-2xl font-extrabold">{t('adminPage.reportTitle')}</h2>
              <p className="text-sm text-muted-foreground">
                TX Futures Alliance · FC Brownsville × Racing de Santander —{' '}
                {new Date(report.generated_at).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={t('adminPage.studentsServed')} value={report.students_served} />
              <Stat label={t('adminPage.certificates')} value={report.certificates_earned} />
              <Stat
                label={t('adminPage.avgWeeksJob')}
                value={report.avg_weeks_to_first_job ?? '—'}
              />
              <Stat label={t('adminPage.athletesRecruited')} value={report.athletes_recruited} />
              <Stat label={t('adminPage.scholApplied')} value={report.scholarships.applied} />
              <Stat label={t('adminPage.scholAwarded')} value={report.scholarships.awarded} />
              <Stat label={t('adminPage.scholDollars')} value={fmtMoney(report.scholarships.dollars)} />
              <Stat label={t('adminPage.enrollments')} value={report.college_enrollments} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <section className="rounded-2xl border bg-card p-5 shadow-sm">
                <h3 className="text-sm font-semibold">{t('adminPage.byPathway')}</h3>
                <dl className="mt-2 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-career">{t('pathways.career')}</dt>
                    <dd className="font-semibold">{report.by_pathway.career}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-college">{t('pathways.college')}</dt>
                    <dd className="font-semibold">{report.by_pathway.college}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sports">{t('pathways.sports')}</dt>
                    <dd className="font-semibold">{report.by_pathway.sports}</dd>
                  </div>
                </dl>
              </section>
              <section className="rounded-2xl border bg-card p-5 shadow-sm">
                <h3 className="text-sm font-semibold">{t('adminPage.byPartner')}</h3>
                {report.placements_by_partner.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">{t('app.empty')}</p>
                ) : (
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {report.placements_by_partner.map((p) => (
                      <li key={p.partner_id} className="flex items-center justify-between gap-2">
                        <span>{p.partner_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {t('adminPage.partnerStat', { n: p.placements, done: p.completed, ft: p.converted_to_full_time })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 text-center">
      <p className="font-display text-3xl font-extrabold text-gold-deep">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/* ---------------------------- Content tab ------------------------------ */

type Row = Record<string, unknown> & { verified_on?: string | null; verified_by?: string | null };

const COLLECTIONS: Array<{ key: ContentCollection; idField: string; nameField: string }> = [
  { key: 'careers', idField: 'career_id', nameField: 'title_en' },
  { key: 'colleges', idField: 'college_id', nameField: 'name' },
  { key: 'scholarships', idField: 'scholarship_id', nameField: 'name' },
  { key: 'opportunities', idField: 'opportunity_id', nameField: 'title_en' },
];

function ContentTab() {
  const { t, lang } = useI18n();
  const [collection, setCollection] = useState<ContentCollection>('careers');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback((col: ContentCollection) => {
    setLoading(true);
    const fetcher =
      col === 'careers'
        ? listCareers()
        : col === 'colleges'
          ? listColleges({ page_size: 100 })
          : col === 'scholarships'
            ? searchScholarships({ page_size: 100 })
            : listOpportunities();
    fetcher
      .then((r) => setRows(r.data as unknown as Row[]))
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(collection), [collection, load]);

  const meta = COLLECTIONS.find((c) => c.key === collection)!;

  const save = async (id: string | null, body: Record<string, unknown>) => {
    if (id) await updateContent(collection, id, body);
    else await createContent(collection, body);
    setToast(t(id ? 'adminPage.updated' : 'adminPage.created'));
    setTimeout(() => setToast(''), 3000);
    setEditRow(null);
    setAdding(false);
    load(collection);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-full border p-1">
          {COLLECTIONS.map((c) => (
            <button
              key={c.key}
              onClick={() => setCollection(c.key)}
              className={cn(
                'min-touch rounded-full px-3 py-1.5 text-xs font-semibold',
                collection === c.key ? 'bg-gold text-white' : 'text-muted-foreground',
              )}
            >
              {t(`adminPage.collections.${c.key}`)}
            </button>
          ))}
        </div>
        <Button size="sm" className="min-touch rounded-full" onClick={() => setAdding(true)}>
          {t('adminPage.addNew')}
        </Button>
      </div>

      {toast && <p className="mb-3 rounded-xl border border-gold/50 bg-gold-soft/50 px-4 py-2 text-sm">{toast}</p>}

      <QueryBoundary loading={loading} error={error} onRetry={() => load(collection)}>
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-3">{t('adminPage.colName')}</th>
                <th className="p-3">{t('adminPage.colVerified')}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const id = String(r[meta.idField]);
                const stale = needsReverification(r.verified_on);
                return (
                  <tr key={id} className="border-b last:border-0">
                    <td className="p-3 font-medium">
                      {collection === 'careers' && lang === 'es' && r.title_es
                        ? String(r.title_es)
                        : String(r[meta.nameField] ?? '—')}
                    </td>
                    <td className="p-3">
                      {stale ? (
                        <Badge variant="destructive" className="gap-1 text-[10px]">
                          <AlertTriangle className="h-3 w-3" aria-hidden />
                          {t('adminPage.needsReverify')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <BadgeCheck className="h-3 w-3" aria-hidden />
                          {t('adminPage.verifiedOn', { date: r.verified_on ?? '', name: r.verified_by ?? '' })}
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="outline" className="min-touch rounded-full" onClick={() => setEditRow(r)}>
                        {t('sportsPage.editProfile')}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </QueryBoundary>

      <ContentEditDialog
        collection={collection}
        row={editRow}
        adding={adding}
        onClose={() => {
          setEditRow(null);
          setAdding(false);
        }}
        onSave={save}
      />
    </div>
  );
}

function ContentEditDialog({
  collection,
  row,
  adding,
  onClose,
  onSave,
}: {
  collection: ContentCollection;
  row: Row | null;
  adding: boolean;
  onClose: () => void;
  onSave: (id: string | null, body: Record<string, unknown>) => Promise<void>;
}) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [nameEs, setNameEs] = useState('');
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const open = !!row || adding;

  useEffect(() => {
    if (open) {
      const nameField = collection === 'careers' || collection === 'opportunities' ? 'title_en' : 'name';
      setName(String(row?.[nameField] ?? ''));
      setNameEs(String(row?.title_es ?? ''));
      setExtra('');
    }
  }, [open, row, collection]);

  const idField = COLLECTIONS.find((c) => c.key === collection)!.idField;

  const submit = async () => {
    setBusy(true);
    const body: Record<string, unknown> = {};
    if (collection === 'careers' || collection === 'opportunities') {
      body.title_en = name;
      if (nameEs) body.title_es = nameEs;
    } else {
      body.name = name;
    }
    if (collection === 'scholarships' && extra) body.award_amount_max = Number(extra) || undefined;
    if (collection === 'careers' && extra) body.pay_rgv_start_usd_hr = Number(extra) || undefined;
    if (collection === 'colleges' && extra) body.cost_per_year_usd = Number(extra) || undefined;
    if (collection === 'opportunities' && extra) body.cost_usd = Number(extra) || undefined;
    try {
      await onSave(row ? String(row[idField]) : null, body);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {adding ? t('adminPage.addTitle') : t('adminPage.editTitle')} — {t(`adminPage.collections.${collection}`)}
          </DialogTitle>
          <DialogDescription>{t('adminPage.stampNote')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="ce-name">{t('adminPage.fNameEn')}</Label>
            <Input id="ce-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {(collection === 'careers' || collection === 'opportunities') && (
            <div>
              <Label htmlFor="ce-name-es">{t('adminPage.fNameEs')}</Label>
              <Input id="ce-name-es" value={nameEs} onChange={(e) => setNameEs(e.target.value)} />
            </div>
          )}
          <div>
            <Label htmlFor="ce-extra">{t(`adminPage.fExtra.${collection}`)}</Label>
            <Input id="ce-extra" inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} />
          </div>
          {row && (
            <p className="text-xs text-muted-foreground">
              {t('adminPage.verifiedOn', { date: row.verified_on ?? '—', name: row.verified_by ?? '—' })}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="min-touch rounded-full" onClick={onClose}>{t('sportsPage.cancel')}</Button>
          <Button className="min-touch rounded-full" disabled={busy || !name.trim()} onClick={() => void submit()}>
            {t('sportsPage.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Demo tab ------------------------------- */

function DemoTab() {
  const { t } = useI18n();
  const [stats, setStats] = useState<{ total: number; explorer: number; pathways: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [forceErrors, setForceErrors] = useState(() => localStorage.getItem(FORCE_ERRORS_KEY) === '1');
  const [resetMsg, setResetMsg] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([listStudents({ page: 1, page_size: 100 }), listStudents({ page: 2, page_size: 100 })])
      .then(([p1, p2]) => {
        const all = [...p1.data, ...p2.data];
        setStats({
          total: p1.meta.total_items,
          explorer: all.filter((s) => s.app_mode === 'explorer').length,
          pathways: all.filter((s) => s.app_mode === 'pathways').length,
        });
      })
      .catch(setError)
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  const doReset = async () => {
    await resetDemoData();
    setResetMsg(true);
    load();
    setTimeout(() => setResetMsg(false), 4000);
  };

  return (
    <div>
      <QueryBoundary loading={loading} error={error} onRetry={load}>
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <Stat label={t('admin.students')} value={stats.total} />
            <Stat label={t('admin.explorer')} value={stats.explorer} />
            <Stat label={t('admin.pathways')} value={stats.pathways} />
          </div>
        )}
      </QueryBoundary>

      <div className="mt-8 space-y-4 rounded-2xl border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="force-errors" className="text-sm font-semibold">{t('admin.forceErrors')}</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('admin.forceErrorsHint')}</p>
          </div>
          <Switch
            id="force-errors"
            checked={forceErrors}
            onCheckedChange={(on) => {
              setForceErrors(on);
              localStorage.setItem(FORCE_ERRORS_KEY, on ? '1' : '0');
            }}
            className="min-touch"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="min-touch rounded-full" onClick={doReset}>
            {t('admin.resetData')}
          </Button>
          {resetMsg && <span className="text-sm text-sports">{t('admin.resetDone')}</span>}
        </div>
      </div>
    </div>
  );
}
