/**
 * Partner portal — employers and training schools post jobs, internships
 * and certificate classes; colleges and clubs post opportunities (via the
 * admin-shared content endpoint is admin-only, so partners manage their
 * internship_postings here). Partners see only opted-in students (scout
 * search lives on the Sports page) and track applicants + placements.
 * Maps to corporate_partners, internship_postings, student_placements.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useI18n } from '@/i18n';
import {
  createPartnerPosting,
  getPartnerApplicants,
  getPartnerMe,
  getPartnerPlacements,
  getPartnerPostings,
  updatePartnerPosting,
} from '@/api';
import type {
  CorporatePartner,
  InternshipPosting,
  PartnerApplicant,
  StudentPlacement,
} from '@/api/types';
import { QueryBoundary } from '@/components/QueryBoundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Briefcase, Building2, CircleDollarSign, MapPin, Plus, Search, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCENT } from './pathwayAccents';

const A = ACCENT.career;

function fmtDate(iso: string, lang: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PartnerPage() {
  const { t, lang } = useI18n();
  const [org, setOrg] = useState<CorporatePartner | null>(null);
  const [postings, setPostings] = useState<InternshipPosting[]>([]);
  const [applicants, setApplicants] = useState<PartnerApplicant[]>([]);
  const [placements, setPlacements] = useState<StudentPlacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [postOpen, setPostOpen] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getPartnerMe(), getPartnerPostings(), getPartnerApplicants(), getPartnerPlacements()])
      .then(([o, p, a, pl]) => {
        setOrg(o);
        setPostings(p.data);
        setApplicants(a.data);
        setPlacements(pl.data);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const flash = (key: string) => {
    setToast(t(key));
    setTimeout(() => setToast(''), 3500);
  };

  const closePosting = (p: InternshipPosting) => {
    updatePartnerPosting(p.posting_id, { posting_status: 'Closed' }).then(() => {
      flash('partnerPage.closed');
      load();
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className={cn('h-7 w-7', A.text)} />
            <h1 className="font-display text-3xl font-extrabold tracking-tight">{t('partnerPage.title')}</h1>
          </div>
          {org && (
            <p className="mt-1 text-sm text-muted-foreground">
              {org.company_name} · {org.rgv_location} · {t('partnerPage.tier', { tier: org.partnership_tier })}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="min-touch rounded-full">
            <Link to="/sports">
              <Search className="h-4 w-4" /> {t('partnerPage.scoutLink')}
            </Link>
          </Button>
          <Button className={cn('min-touch rounded-full text-white', A.bg)} onClick={() => setPostOpen(true)}>
            <Plus className="h-4 w-4" /> {t('partnerPage.newPosting')}
          </Button>
        </div>
      </header>

      <p className="mb-4 rounded-xl border border-gold/50 bg-gold-soft/40 p-3 text-sm text-muted-foreground">
        {t('partnerPage.optInNote')}
      </p>

      {toast && (
        <p className={cn('mb-4 rounded-xl border px-4 py-2 text-sm', A.soft, A.border, A.text)}>{toast}</p>
      )}

      <QueryBoundary loading={loading} error={error} onRetry={load}>
        <Tabs defaultValue="postings">
          <TabsList>
            <TabsTrigger value="postings">{t('partnerPage.tabPostings', { count: postings.length })}</TabsTrigger>
            <TabsTrigger value="applicants">{t('partnerPage.tabApplicants', { count: applicants.length })}</TabsTrigger>
            <TabsTrigger value="placements">{t('partnerPage.tabPlacements', { count: placements.length })}</TabsTrigger>
          </TabsList>

          <TabsContent value="postings">
            {postings.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{t('partnerPage.noPostings')}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {postings.map((p) => (
                  <article key={p.posting_id} className="rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold leading-tight">{p.job_title}</h3>
                      <Badge variant={p.posting_status === 'Open' ? 'secondary' : 'outline'} className="shrink-0 text-[10px]">
                        {p.posting_status}
                      </Badge>
                    </div>
                    <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" aria-hidden /> {p.location}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CircleDollarSign className="h-3.5 w-3.5" aria-hidden />
                        {p.pay_type}{p.pay_rate ? ` · $${p.pay_rate}/hr` : ''}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" aria-hidden />
                        {t('partnerPage.positions', { filled: p.positions_filled, total: p.positions_available })}
                      </div>
                    </dl>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('partnerPage.deadline')} {fmtDate(p.application_deadline, lang)}
                    </p>
                    {p.posting_status === 'Open' && (
                      <Button size="sm" variant="outline" className="mt-3 min-touch rounded-full" onClick={() => closePosting(p)}>
                        {t('partnerPage.closePosting')}
                      </Button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="applicants">
            {applicants.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{t('partnerPage.noApplicants')}</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="p-3">{t('partnerPage.colApplicant')}</th>
                      <th className="p-3">{t('partnerPage.colPosting')}</th>
                      <th className="p-3">{t('partnerPage.colStatus')}</th>
                      <th className="p-3">{t('partnerPage.colApplied')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applicants.map((a) => (
                      <tr key={a.application_id} className="border-b last:border-0">
                        <td className="p-3 font-medium">{a.student_display}</td>
                        <td className="p-3">{a.posting_title}</td>
                        <td className="p-3">
                          <Badge variant="secondary">{t(`appStatus.${a.status}`)}</Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">{fmtDate(a.applied_at, lang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="placements">
            {placements.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{t('partnerPage.noPlacements')}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {placements.map((p) => (
                  <article key={p.placement_id} className="rounded-2xl border bg-card p-4 shadow-sm text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold">{p.job_title}</h3>
                      <Badge variant={p.completion_status === 'active' ? 'secondary' : 'outline'}>
                        {t(`partnerPage.placement.${p.completion_status}`)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {fmtDate(p.start_date, lang)} → {fmtDate(p.actual_end_date ?? p.end_date, lang)}
                      {p.pay_rate ? ` · $${p.pay_rate}/hr` : ''}
                    </p>
                    {p.offered_full_time && (
                      <Badge className="mt-2 bg-sports-soft text-sports">
                        {p.accepted_full_time ? t('partnerPage.ftAccepted') : t('partnerPage.ftOffered')}
                      </Badge>
                    )}
                  </article>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </QueryBoundary>

      <NewPostingDialog
        open={postOpen}
        onClose={() => setPostOpen(false)}
        onCreated={() => {
          setPostOpen(false);
          flash('partnerPage.created');
          load();
        }}
      />
    </div>
  );
}

function NewPostingDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('Brownsville, TX');
  const [payType, setPayType] = useState<InternshipPosting['pay_type']>('Hourly');
  const [payRate, setPayRate] = useState('');
  const [weeks, setWeeks] = useState('8');
  const [hours, setHours] = useState('10');
  const [deadline, setDeadline] = useState('2027-03-01');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const save = () => {
    setBusy(true);
    createPartnerPosting({
      job_title: title,
      location,
      pay_type: payType,
      pay_rate: payRate ? Number(payRate) : null,
      duration_weeks: Number(weeks) || 8,
      hours_per_week: Number(hours) || 10,
      application_deadline: deadline,
      description,
    })
      .then(onCreated)
      .catch(() => {})
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('partnerPage.newPostingTitle')}</DialogTitle>
          <DialogDescription>{t('partnerPage.newPostingHint')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="np-title">{t('partnerPage.fTitle')}</Label>
            <Input id="np-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="np-loc">{t('partnerPage.fLocation')}</Label>
            <Input id="np-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('partnerPage.fPayType')}</Label>
              <Select value={payType} onValueChange={(v) => setPayType(v as InternshipPosting['pay_type'])}>
                <SelectTrigger className="min-touch"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hourly">{t('partnerPage.payType.Hourly')}</SelectItem>
                  <SelectItem value="Stipend">{t('partnerPage.payType.Stipend')}</SelectItem>
                  <SelectItem value="Unpaid">{t('partnerPage.payType.Unpaid')}</SelectItem>
                  <SelectItem value="Credit Only">{t('partnerPage.payType.Credit Only')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="np-rate">{t('partnerPage.fPayRate')}</Label>
              <Input id="np-rate" inputMode="decimal" value={payRate} onChange={(e) => setPayRate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="np-weeks">{t('partnerPage.fWeeks')}</Label>
              <Input id="np-weeks" inputMode="numeric" value={weeks} onChange={(e) => setWeeks(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="np-hours">{t('partnerPage.fHours')}</Label>
              <Input id="np-hours" inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="np-due">{t('partnerPage.fDeadline')}</Label>
              <Input id="np-due" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="np-desc">{t('partnerPage.fDesc')}</Label>
            <Textarea id="np-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="min-touch rounded-full" onClick={onClose}>{t('sportsPage.cancel')}</Button>
          <Button
            className={cn('min-touch rounded-full text-white', A.bg)}
            disabled={busy || !title.trim() || !location.trim()}
            onClick={save}
          >
            <Briefcase className="h-4 w-4" /> {t('partnerPage.publish')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
