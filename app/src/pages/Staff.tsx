/**
 * Coach / Counselor side — caseload with pathway status, next deadlines,
 * missing items and needs-attention flags; student detail with notes,
 * task assignment, transcript verification, Racing 360 metrics link and
 * endorsements; EN/ES bulk messaging.
 */
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import {
  addEndorsement,
  addStaffNote,
  createPlanAction,
  getCaseload,
  getDocuments,
  getStaffNotes,
  getStudent,
  sendBulkMessage,
  verifyDocument,
} from '@/api';
import type { AppStudent, CaseloadItem, StaffNote, StudentDocument } from '@/api/types';
import { QueryBoundary } from '@/components/QueryBoundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  MessageSquareText,
  Send,
  StickyNote,
  Trophy,
  Users,
} from 'lucide-react';
import { Link } from 'react-router';
import { ACCENT } from './pathwayAccents';
import { cn } from '@/lib/utils';

const A = ACCENT.college;

function fmtDate(iso: string, lang: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function StaffPage() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<CaseloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [selected, setSelected] = useState<CaseloadItem | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    getCaseload()
      .then((r) => setItems(r.data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const flash = (key: string, vars?: Record<string, string | number>) => {
    setToast(t(key, vars));
    setTimeout(() => setToast(''), 3500);
  };

  if (selected) {
    return (
      <StudentDetail
        item={selected}
        onBack={() => {
          setSelected(null);
          load();
        }}
        flash={flash}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className={cn('h-7 w-7', A.text)} />
            <h1 className="font-display text-3xl font-extrabold tracking-tight">{t('staffPage.title')}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('staffPage.subtitle')}</p>
        </div>
        <Button
          className={cn('min-touch rounded-full text-white', A.bg)}
          disabled={checked.size === 0}
          onClick={() => setBulkOpen(true)}
        >
          <MessageSquareText className="h-4 w-4" />
          {t('staffPage.bulkBtn', { count: checked.size })}
        </Button>
      </header>

      {toast && (
        <p className={cn('mb-4 rounded-xl border px-4 py-2 text-sm', A.soft, A.border, A.text)}>{toast}</p>
      )}

      <QueryBoundary loading={loading} error={error} onRetry={load} isEmpty={items.length === 0}>
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-3" aria-label={t('staffPage.bulkCol')} />
                <th className="p-3">{t('staffPage.colStudent')}</th>
                <th className="p-3">{t('staffPage.colPathways')}</th>
                <th className="p-3">{t('staffPage.colDeadline')}</th>
                <th className="p-3">{t('staffPage.colMissing')}</th>
                <th className="p-3">{t('staffPage.colFlags')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr
                  key={c.student_id}
                  className="cursor-pointer border-b last:border-0 hover:bg-muted/50"
                  onClick={() => setSelected(c)}
                >
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      className="min-touch"
                      checked={checked.has(c.student_id)}
                      onCheckedChange={(v) =>
                        setChecked((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(c.student_id);
                          else next.delete(c.student_id);
                          return next;
                        })
                      }
                      aria-label={`${c.first_name} ${c.last_name}`}
                    />
                  </td>
                  <td className="p-3">
                    <p className="font-medium">
                      {c.first_name} {c.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.school_name} · {t('staffPage.grade', { grade: c.grade_level ?? '—' })}
                    </p>
                  </td>
                  <td className="p-3 text-xs">
                    <span className="mr-2 inline-flex items-center gap-1">
                      <ClipboardList className="h-3 w-3 text-career" aria-hidden />
                      {c.pathway_status.career.saved + c.pathway_status.career.plans + c.pathway_status.career.applications}
                    </span>
                    <span className="mr-2 inline-flex items-center gap-1">
                      <GraduationCap className="h-3 w-3 text-college" aria-hidden />
                      {c.pathway_status.college.saved + c.pathway_status.college.applications}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Trophy className="h-3 w-3 text-sports" aria-hidden />
                      {c.pathway_status.sports.has_profile ? c.pathway_status.sports.videos : 0}
                    </span>
                  </td>
                  <td className="p-3 text-xs">
                    {c.next_deadline ? (
                      <>
                        {(lang === 'es' ? c.next_deadline.title_es : c.next_deadline.title_en)}
                        <span className="block text-muted-foreground">{fmtDate(c.next_deadline.date, lang)}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {c.missing_items.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      {c.missing_items.map((m) => (
                        <Badge key={m} variant="secondary" className="text-[10px]">
                          {t(`staffPage.missing.${m}`)}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {c.needs_attention.length === 0 && (
                        <CheckCircle2 className="h-4 w-4 text-sports" aria-label={t('staffPage.ok')} />
                      )}
                      {c.needs_attention.map((f) => (
                        <Badge key={f} variant="destructive" className="gap-1 text-[10px]">
                          <AlertTriangle className="h-3 w-3" aria-hidden />
                          {t(`staffPage.flags.${f}`)}
                        </Badge>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryBoundary>

      <BulkMessageDialog
        studentIds={[...checked]}
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onSent={(n) => {
          setBulkOpen(false);
          setChecked(new Set());
          flash('staffPage.bulkSent', { count: n });
        }}
      />
    </div>
  );
}

/* ---------------------------- student detail --------------------------- */

function StudentDetail({
  item,
  onBack,
  flash,
}: {
  item: CaseloadItem;
  onBack: () => void;
  flash: (key: string, vars?: Record<string, string | number>) => void;
}) {
  const { t, lang } = useI18n();
  const [student, setStudent] = useState<AppStudent | null>(null);
  const [notes, setNotes] = useState<StaffNote[]>([]);
  const [docs, setDocs] = useState<StudentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [noteText, setNoteText] = useState('');
  const [endorseText, setEndorseText] = useState('');
  const [taskOpen, setTaskOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getStudent(item.student_id), getStaffNotes(item.student_id), getDocuments(item.student_id)])
      .then(([s, n, d]) => {
        setStudent(s);
        setNotes(n.data);
        setDocs(d.data);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [item.student_id]);

  useEffect(load, [load]);

  const addNote = () => {
    if (!noteText.trim()) return;
    setBusy(true);
    addStaffNote(item.student_id, noteText.trim())
      .then(() => {
        setNoteText('');
        flash('staffPage.noteAdded');
        load();
      })
      .finally(() => setBusy(false));
  };

  const endorse = () => {
    if (!endorseText.trim()) return;
    setBusy(true);
    addEndorsement(item.student_id, endorseText.trim())
      .then(() => {
        setEndorseText('');
        flash('staffPage.endorsed');
      })
      .finally(() => setBusy(false));
  };

  const verify = (docId: string) => {
    verifyDocument(item.student_id, docId).then(() => {
      flash('staffPage.verified');
      load();
    });
  };

  const hasSport = item.pathway_status.sports.has_profile;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Button variant="ghost" className="min-touch -ml-2 mb-4 rounded-full" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> {t('staffPage.back')}
      </Button>
      <QueryBoundary loading={loading} error={error} onRetry={load}>
        {student && (
          <>
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-extrabold tracking-tight">
                  {student.first_name} {student.last_name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {student.school_name} · {t('staffPage.grade', { grade: student.current_grade_level ?? '—' })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="min-touch rounded-full" onClick={() => setTaskOpen(true)}>
                  <ClipboardList className="h-4 w-4" /> {t('staffPage.assignTask')}
                </Button>
                {hasSport && (
                  <Button asChild variant="outline" className="min-touch rounded-full">
                    <Link to="/sports">{t('staffPage.enterMetrics')}</Link>
                  </Button>
                )}
              </div>
            </header>

            {/* Pathway status */}
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border bg-card p-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-career">
                  <ClipboardList className="h-4 w-4" /> {t('pathways.career')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('staffPage.careerStat', {
                    saved: item.pathway_status.career.saved,
                    plans: item.pathway_status.career.plans,
                    apps: item.pathway_status.career.applications,
                  })}
                </p>
              </div>
              <div className="rounded-2xl border bg-card p-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-college">
                  <GraduationCap className="h-4 w-4" /> {t('pathways.college')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('staffPage.collegeStat', {
                    saved: item.pathway_status.college.saved,
                    apps: item.pathway_status.college.applications,
                    awarded: item.pathway_status.college.awarded,
                  })}
                </p>
              </div>
              <div className="rounded-2xl border bg-card p-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-sports">
                  <Trophy className="h-4 w-4" /> {t('pathways.sports')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.pathway_status.sports.has_profile
                    ? t('staffPage.sportsStat', {
                        videos: item.pathway_status.sports.videos,
                        reqs: item.pathway_status.sports.contact_requests,
                      })
                    : t('staffPage.noSportsProfile')}
                </p>
              </div>
            </div>

            {/* Transcript verification */}
            <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <FileCheck2 className="h-4 w-4" aria-hidden /> {t('staffPage.docsTitle')}
              </h2>
              {docs.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">{t('staffPage.noDocs')}</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {docs.map((d) => (
                    <li key={d.document_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
                      <div>
                        <p className="font-medium">{d.file_name}</p>
                        <p className="text-xs text-muted-foreground">{d.kind} · {fmtDate(d.uploaded_at, lang)}</p>
                      </div>
                      {d.verified_at ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {t('staffPage.verifiedOn', { date: fmtDate(d.verified_at, lang), name: d.verified_by ?? '' })}
                        </Badge>
                      ) : (
                        <Button size="sm" variant="outline" className="min-touch rounded-full" onClick={() => verify(d.document_id)}>
                          {t('staffPage.verify')}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Notes */}
            <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <StickyNote className="h-4 w-4" aria-hidden /> {t('staffPage.notesTitle')}
              </h2>
              <div className="mt-3 flex gap-2">
                <Textarea
                  rows={2}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={t('staffPage.notePh')}
                  aria-label={t('staffPage.notesTitle')}
                />
                <Button className={cn('min-touch self-end rounded-full text-white', A.bg)} disabled={busy || !noteText.trim()} onClick={addNote}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <ul className="mt-3 space-y-2">
                {notes.map((n) => (
                  <li key={n.note_id} className="rounded-xl bg-muted/60 p-3 text-sm">
                    <p>{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {n.author_name} · {fmtDate(n.created_at, lang)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            {/* Endorse player */}
            {hasSport && (
              <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Trophy className="h-4 w-4" aria-hidden /> {t('staffPage.endorseTitle')}
                </h2>
                <div className="mt-3 flex gap-2">
                  <Textarea
                    rows={2}
                    value={endorseText}
                    onChange={(e) => setEndorseText(e.target.value)}
                    placeholder={t('staffPage.endorsePh')}
                    aria-label={t('staffPage.endorseTitle')}
                  />
                  <Button className={cn('min-touch self-end rounded-full text-white', A.bg)} disabled={busy || !endorseText.trim()} onClick={endorse}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </section>
            )}

            <AssignTaskDialog
              studentId={item.student_id}
              open={taskOpen}
              onClose={() => setTaskOpen(false)}
              onAssigned={() => {
                setTaskOpen(false);
                flash('staffPage.taskAssigned');
              }}
            />
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

function AssignTaskDialog({
  studentId,
  open,
  onClose,
  onAssigned,
}: {
  studentId: string;
  open: boolean;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const { t } = useI18n();
  const [pathway, setPathway] = useState<'career' | 'college' | 'sports'>('career');
  const [titleEn, setTitleEn] = useState('');
  const [titleEs, setTitleEs] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);

  const save = () => {
    setBusy(true);
    createPlanAction(studentId, {
      pathway,
      title_en: titleEn,
      title_es: titleEs || titleEn,
      due_date: due || undefined,
    })
      .then(onAssigned)
      .catch(() => {})
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('staffPage.assignTitle')}</DialogTitle>
          <DialogDescription>{t('staffPage.assignHint')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t('staffPage.taskPathway')}</Label>
            <Select value={pathway} onValueChange={(v) => setPathway(v as typeof pathway)}>
              <SelectTrigger className="min-touch"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="career">{t('pathways.career')}</SelectItem>
                <SelectItem value="college">{t('pathways.college')}</SelectItem>
                <SelectItem value="sports">{t('pathways.sports')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="task-en">{t('staffPage.taskEn')}</Label>
            <Input id="task-en" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="task-es">{t('staffPage.taskEs')}</Label>
            <Input id="task-es" value={titleEs} onChange={(e) => setTitleEs(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="task-due">{t('staffPage.taskDue')}</Label>
            <Input id="task-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="min-touch rounded-full" onClick={onClose}>{t('sportsPage.cancel')}</Button>
          <Button className={cn('min-touch rounded-full text-white', A.bg)} disabled={busy || !titleEn.trim()} onClick={save}>
            {t('sportsPage.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- bulk message ---------------------------- */

const TEMPLATES = [
  {
    key: 'deadline',
    en: 'Reminder: you have a deadline coming up. Check your dashboard and let me know if you need help.',
    es: 'Recordatorio: tienes una fecha límite próxima. Revisa tu panel y avísame si necesitas ayuda.',
  },
  {
    key: 'grades',
    en: 'Please bring or upload your latest report card so we can update your scholarship matches.',
    es: 'Por favor trae o sube tu reporte de calificaciones más reciente para actualizar tus becas.',
  },
  {
    key: 'event',
    en: 'There is an event coming up that fits your plan. Check the Opportunities or Home page for details.',
    es: 'Hay un evento próximo que encaja con tu plan. Revisa la página de Oportunidades o Inicio para más detalles.',
  },
] as const;

function BulkMessageDialog({
  studentIds,
  open,
  onClose,
  onSent,
}: {
  studentIds: string[];
  open: boolean;
  onClose: () => void;
  onSent: (count: number) => void;
}) {
  const { t } = useI18n();
  const [template, setTemplate] = useState<(typeof TEMPLATES)[number]['key']>('deadline');
  const [bodyEn, setBodyEn] = useState<string>(TEMPLATES[0].en);
  const [bodyEs, setBodyEs] = useState<string>(TEMPLATES[0].es);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const tpl = TEMPLATES.find((x) => x.key === template) ?? TEMPLATES[0];
    setBodyEn(tpl.en);
    setBodyEs(tpl.es);
  }, [template]);

  const send = () => {
    setBusy(true);
    sendBulkMessage(studentIds, bodyEn, bodyEs)
      .then((r) => onSent(r.sent))
      .catch(() => {})
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('staffPage.bulkTitle', { count: studentIds.length })}</DialogTitle>
          <DialogDescription>{t('staffPage.bulkHint')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t('staffPage.bulkTemplate')}</Label>
            <Select value={template} onValueChange={(v) => setTemplate(v as typeof template)}>
              <SelectTrigger className="min-touch"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((tpl) => (
                  <SelectItem key={tpl.key} value={tpl.key}>
                    {t(`staffPage.templates.${tpl.key}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="bulk-en">{t('staffPage.bulkEn')}</Label>
            <Textarea id="bulk-en" rows={3} value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="bulk-es">{t('staffPage.bulkEs')}</Label>
            <Textarea id="bulk-es" rows={3} value={bodyEs} onChange={(e) => setBodyEs(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="min-touch rounded-full" onClick={onClose}>{t('sportsPage.cancel')}</Button>
          <Button className={cn('min-touch rounded-full text-white', A.bg)} disabled={busy || !bodyEn.trim()} onClick={send}>
            <Send className="h-4 w-4" /> {t('staffPage.bulkSend')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
