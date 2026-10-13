/**
 * Sports Career pathway — recruiting profile, video library, performance
 * timeline, Racing 360 reports (via the adapter in src/api/racing360.ts),
 * three opportunity lanes, the partner scout view, and the ever-present
 * Plan B banner.
 *
 * Consent rules are enforced mock-side: scouts only see opted-in students,
 * never contact info, and under-18 contact needs a parent's approval.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
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
import { useI18n } from '@/i18n';
import { getSession } from '@/api/auth';
import { DEFAULT_STUDENT_ID } from '@/api/personas';
import {
  getContactRequests,
  getHighlights,
  getPerformanceTimeline,
  getRecruitingPreview,
  getRecruitingProfile,
  getRecruitmentReels,
  getStudent,
  getVideos,
  listOpportunities,
  requestContact,
  respondContactRequest,
  searchRecruitingProfiles,
  updateRecruitingProfile,
  uploadVideo,
  type ScoutPreview,
} from '@/api';
import {
  enterRacing360Metrics,
  getRacing360Reports,
  importRacing360File,
} from '@/api/racing360';
import type {
  AppStudent,
  ContactRequest,
  OpportunityLane,
  PerformancePoint,
  Racing360Report,
  RecruitingProfile,
  RecruitmentReel,
  ScoutResult,
  SportOpportunity,
  VideoHighlight,
  VideoUpload,
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
import {
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Eye,
  FileUp,
  Flag,
  Globe2,
  GraduationCap,
  LineChart as LineChartIcon,
  MapPin,
  Pencil,
  Play,
  ShieldCheck,
  Sparkles,
  Trophy,
  Upload,
  Users,
  Video,
} from 'lucide-react';
import { ACCENT } from './pathwayAccents';
import { cn } from '@/lib/utils';

const A = ACCENT.sports;

function fmtHeight(inches: number): string {
  const ft = Math.floor(inches / 12);
  const inch = inches % 12;
  return `${ft}'${inch}"`;
}

function fmtDate(iso: string, lang: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/* =============================== page ================================== */

export default function SportsPage() {
  const { t } = useI18n();
  const session = getSession();
  const role = session?.user.role;

  const [student, setStudent] = useState<AppStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const isPartner = role === 'partner';
  const isStaff = role === 'coach' || role === 'club_staff' || role === 'admin';
  const studentId =
    role === 'parent'
      ? session?.user.child_ids?.[0]
      : role === 'student'
        ? session?.user.student_id
        : isStaff
          ? DEFAULT_STUDENT_ID
          : undefined;

  useEffect(() => {
    if (!studentId || isPartner) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getStudent(studentId)
      .then(setStudent)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [studentId, isPartner]);

  if (isPartner) return <ScoutView />;

  if (!loading && !error && student?.app_mode === 'explorer') return <SportsExplorerLite />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <Trophy className={cn('h-7 w-7', A.text)} />
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            {t('sportsPage.title')}
          </h1>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('sportsPage.subtitle')}</p>
      </header>

      <PlanBBanner />

      <QueryBoundary loading={loading} error={error} isEmpty={!student} onRetry={() => window.location.reload()}>
        {student && studentId && (
          <Tabs defaultValue="profile" className="mt-6">
            <TabsList className="flex w-full flex-wrap justify-start">
              <TabsTrigger value="profile">{t('sportsPage.tabProfile')}</TabsTrigger>
              <TabsTrigger value="videos">{t('sportsPage.tabVideos')}</TabsTrigger>
              <TabsTrigger value="timeline">{t('sportsPage.tabTimeline')}</TabsTrigger>
              <TabsTrigger value="reports">{t('sportsPage.tabReports')}</TabsTrigger>
              <TabsTrigger value="opportunities">{t('sportsPage.tabOpportunities')}</TabsTrigger>
            </TabsList>
            <TabsContent value="profile">
              <ProfileTab studentId={studentId} canEdit={role === 'student' || isStaff} />
            </TabsContent>
            <TabsContent value="videos">
              <VideosTab studentId={studentId} />
            </TabsContent>
            <TabsContent value="timeline">
              <TimelineTab studentId={studentId} />
            </TabsContent>
            <TabsContent value="reports">
              <ReportsTab studentId={studentId} canCoach={isStaff} />
            </TabsContent>
            <TabsContent value="opportunities">
              <OpportunitiesTab />
            </TabsContent>
          </Tabs>
        )}
      </QueryBoundary>
    </div>
  );
}

/* --------------------------- Plan B banner ----------------------------- */

function PlanBBanner() {
  const { t } = useI18n();
  return (
    <aside className="rounded-2xl border-2 border-gold/50 bg-gold-soft/40 p-4 sm:flex sm:items-center sm:gap-4">
      <ShieldCheck className="h-8 w-8 shrink-0 text-gold-deep" aria-hidden />
      <div className="mt-2 sm:mt-0">
        <p className="text-sm font-semibold">{t('sportsPage.planBTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('sportsPage.planBBody')}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 sm:ml-auto sm:mt-0">
        <Button asChild variant="outline" size="sm" className="min-touch rounded-full">
          <Link to="/career">{t('sportsPage.planBCareer')}</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="min-touch rounded-full">
          <Link to="/college">{t('sportsPage.planBCollege')}</Link>
        </Button>
      </div>
    </aside>
  );
}

/* ---------------------------- Profile tab ------------------------------ */

function ProfileTab({
  studentId,
  canEdit,
}: {
  studentId: string;
  canEdit: boolean;
}) {
  const { t, lang } = useI18n();
  const [profile, setProfile] = useState<RecruitingProfile | null>(null);
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [toast, setToast] = useState('');

  const session = getSession();
  const role = session?.user.role;

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getRecruitingProfile(studentId),
      getContactRequests(studentId).catch(() => ({ data: [] as ContactRequest[] })),
    ])
      .then(([p, r]) => {
        setProfile(p);
        setRequests(r.data);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [studentId]);

  useEffect(load, [load]);

  const respond = (rid: string, action: 'approve' | 'decline') => {
    respondContactRequest(studentId, rid, action)
      .then(() => {
        setToast(t(action === 'approve' ? 'sportsPage.approvedMsg' : 'sportsPage.declinedMsg'));
        setTimeout(() => setToast(''), 3500);
        load();
      })
      .catch(() => setToast(t('sportsPage.parentMustApprove')));
  };

  return (
    <QueryBoundary loading={loading} error={error} onRetry={load}>
      {profile && (
        <div className="grid gap-4 lg:grid-cols-3">
          {toast && (
            <p className={cn('rounded-xl border px-4 py-2 text-sm lg:col-span-3', A.soft, A.border, A.text)}>
              {toast}
            </p>
          )}

          {/* Front page card */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm lg:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold">{t('sportsPage.profileTitle')}</h2>
                <p className="text-sm text-muted-foreground">
                  {profile.sport} · {t('sportsPage.gradYear')} {profile.grad_year ?? '—'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canEdit && (
                  <Button variant="outline" size="sm" className="min-touch rounded-full" onClick={() => setEditOpen(true)}>
                    <Pencil className="h-3.5 w-3.5" /> {t('sportsPage.editProfile')}
                  </Button>
                )}
                <Button size="sm" className={cn('min-touch rounded-full text-white', A.bg)} onClick={() => setPreviewOpen(true)}>
                  <Eye className="h-3.5 w-3.5" /> {t('sportsPage.scoutViewBtn')}
                </Button>
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">{t('sportsPage.positions')}</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {profile.positions.map((p) => (
                    <Badge key={p} variant="secondary">{p}</Badge>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('sportsPage.domFoot')}</dt>
                <dd className="mt-1 font-medium">{profile.dominant_foot ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('sportsPage.height')}</dt>
                <dd className="mt-1 font-medium">
                  {profile.height_inches ? fmtHeight(profile.height_inches) : t('sportsPage.notShared')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('sportsPage.weight')}</dt>
                <dd className="mt-1 font-medium">
                  {profile.weight_pounds ? `${profile.weight_pounds} lb` : t('sportsPage.notShared')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('sportsPage.skillLevel')}</dt>
                <dd className="mt-1 font-medium">{profile.skill_level ?? profile.teams[0]?.competitive_level ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('sportsPage.videosTitle')}</dt>
                <dd className="mt-1 font-medium">
                  {profile.video_count} · {profile.highlight_count} highlights
                </dd>
              </div>
            </dl>

            <h3 className="mt-5 text-sm font-semibold">{t('sportsPage.teamsTitle')}</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {profile.teams.map((tm, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Flag className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  <span>{tm.team_name}</span>
                  <span className="text-muted-foreground">
                    {tm.competitive_level}
                    {tm.years_experience != null && ` · ${t('sportsPage.yearsExp', { years: tm.years_experience })}`}
                  </span>
                </li>
              ))}
            </ul>

            {/* Academic snapshot — consent-gated */}
            <h3 className="mt-5 text-sm font-semibold">{t('sportsPage.academicsTitle')}</h3>
            {profile.academic_snapshot ? (
              <p className="mt-1 text-sm">
                {t('sportsPage.gpa')}: <strong>{profile.academic_snapshot.gpa_cumulative.toFixed(2)}</strong>
                <span className="text-muted-foreground"> · {profile.academic_snapshot.school_year}</span>
              </p>
            ) : (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{t('sportsPage.academicsHidden')}</span>
                <Button asChild variant="link" size="sm" className="h-auto p-0">
                  <Link to="/consent">{t('sportsPage.academicsCta')}</Link>
                </Button>
              </div>
            )}
          </section>

          {/* Achievements + endorsements */}
          <div className="space-y-4">
            <section className="rounded-2xl border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-semibold">{t('sportsPage.achievementsTitle')}</h3>
              {profile.achievements.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">{t('sportsPage.noAchievements')}</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {profile.achievements.map((a) => (
                    <li key={a.achievement_id} className="flex gap-2">
                      <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-deep" aria-hidden />
                      <span>
                        {lang === 'es' && a.text_es ? a.text_es : a.text_en}
                        {a.year && <span className="text-muted-foreground"> · {a.year}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-semibold">{t('sportsPage.endorsementsTitle')}</h3>
              {profile.endorsements.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">{t('sportsPage.noEndorsements')}</p>
              ) : (
                <ul className="mt-2 space-y-3 text-sm">
                  {profile.endorsements.map((e) => (
                    <li key={e.endorsement_id} className="rounded-xl bg-muted/60 p-3">
                      <p>“{lang === 'es' && e.text_es ? e.text_es : e.text_en}”</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {e.coach_name} · {e.coach_org}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Contact requests (student / parent) */}
          {(role === 'student' || role === 'parent') && (
            <section className="rounded-2xl border bg-card p-5 shadow-sm lg:col-span-3">
              <h3 className="text-sm font-semibold">{t('sportsPage.contactReqTitle')}</h3>
              {requests.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">{t('sportsPage.noContactReq')}</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {requests.map((r) => (
                    <li key={r.request_id} className="rounded-xl border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{r.requester_org}</p>
                        <Badge variant="outline">
                          {r.status === 'pending_parent'
                            ? t('sportsPage.pendingParent')
                            : r.status === 'pending_student'
                              ? t('sportsPage.pendingStudent')
                              : r.status === 'approved'
                                ? t('sportsPage.stApproved')
                                : t('sportsPage.stDeclined')}
                        </Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">{r.message}</p>
                      {(r.status === 'pending_parent' || r.status === 'pending_student') && (
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" className={cn('min-touch rounded-full text-white', A.bg)} onClick={() => respond(r.request_id, 'approve')}>
                            {t('sportsPage.approve')}
                          </Button>
                          <Button size="sm" variant="outline" className="min-touch rounded-full" onClick={() => respond(r.request_id, 'decline')}>
                            {t('sportsPage.decline')}
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <EditProfileDialog
            studentId={studentId}
            profile={profile}
            open={editOpen}
            onClose={() => setEditOpen(false)}
            onSaved={(p) => {
              setProfile(p);
              setEditOpen(false);
            }}
          />
          <ScoutPreviewDialog studentId={studentId} open={previewOpen} onClose={() => setPreviewOpen(false)} />
        </div>
      )}
    </QueryBoundary>
  );
}

function EditProfileDialog({
  studentId,
  profile,
  open,
  onClose,
  onSaved,
}: {
  studentId: string;
  profile: RecruitingProfile;
  open: boolean;
  onClose: () => void;
  onSaved: (p: RecruitingProfile) => void;
}) {
  const { t } = useI18n();
  const [positions, setPositions] = useState(profile.positions.join(', '));
  const [foot, setFoot] = useState(profile.dominant_foot ?? '');
  const [height, setHeight] = useState(profile.height_inches?.toString() ?? '');
  const [weight, setWeight] = useState(profile.weight_pounds?.toString() ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPositions(profile.positions.join(', '));
      setFoot(profile.dominant_foot ?? '');
      setHeight(profile.height_inches?.toString() ?? '');
      setWeight(profile.weight_pounds?.toString() ?? '');
    }
  }, [open, profile]);

  const save = () => {
    setBusy(true);
    updateRecruitingProfile(studentId, {
      positions: positions.split(',').map((p) => p.trim()).filter(Boolean),
      dominant_foot: foot || null,
      height_inches: height ? Number(height) : null,
      weight_pounds: weight ? Number(weight) : null,
    })
      .then(onSaved)
      .catch(() => {})
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('sportsPage.editTitle')}</DialogTitle>
          <DialogDescription>{t('sportsPage.subtitle')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="sp-pos">{t('sportsPage.positions')}</Label>
            <Input id="sp-pos" value={positions} onChange={(e) => setPositions(e.target.value)} placeholder={t('sportsPage.positionsPh')} />
          </div>
          <div>
            <Label>{t('sportsPage.domFoot')}</Label>
            <Select value={foot} onValueChange={setFoot}>
              <SelectTrigger className="min-touch"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Left">{t('sportsPage.footLeft')}</SelectItem>
                <SelectItem value="Right">{t('sportsPage.footRight')}</SelectItem>
                <SelectItem value="Both">{t('sportsPage.footBoth')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sp-h">{t('sportsPage.height')} (in)</Label>
              <Input id="sp-h" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="sp-w">{t('sportsPage.weight')} (lb)</Label>
              <Input id="sp-w" inputMode="numeric" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="min-touch rounded-full" onClick={onClose}>{t('sportsPage.cancel')}</Button>
          <Button className={cn('min-touch rounded-full text-white', A.bg)} disabled={busy} onClick={save}>
            {t('sportsPage.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------- "See what a scout sees" -------------------------- */

function ScoutPreviewDialog({
  studentId,
  open,
  onClose,
}: {
  studentId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [preview, setPreview] = useState<ScoutPreview | null>(null);

  useEffect(() => {
    if (open) getRecruitingPreview(studentId).then(setPreview).catch(() => setPreview(null));
  }, [open, studentId]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('sportsPage.scoutPreviewTitle')}</DialogTitle>
          <DialogDescription>{t('sportsPage.scoutPreviewNote')}</DialogDescription>
        </DialogHeader>
        {preview && !preview.visible && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p>{t('sportsPage.scoutPreviewHidden')}</p>
            <Button asChild variant="link" size="sm" className="h-auto p-0">
              <Link to="/consent">{t('sportsPage.academicsCta')}</Link>
            </Button>
          </div>
        )}
        {preview?.visible && preview.result && (
          <div className="rounded-xl border bg-muted/50 p-4 text-sm">
            <p className="font-display text-lg font-bold">{preview.result.display_name}</p>
            <p className="text-muted-foreground">
              {preview.result.sport} · {preview.result.positions.join(', ')} ·{' '}
              {t('sportsPage.gradYear')} {preview.result.grad_year ?? '—'}
            </p>
            <p className="mt-1">
              {preview.result.competitive_level} · {preview.result.team_name}
              {preview.result.height_inches ? ` · ${fmtHeight(preview.result.height_inches)}` : ''}
            </p>
            {preview.result.under_18 && (
              <Badge variant="outline" className="mt-2">{t('sportsPage.under18Tag')}</Badge>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {preview.videos_visible ? t('sportsPage.scoutVideosOn') : t('sportsPage.scoutVideosOff')}
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" className="min-touch rounded-full" onClick={onClose}>{t('app.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- Videos tab ------------------------------ */

function VideosTab({ studentId }: { studentId: string }) {
  const { t, lang } = useI18n();
  const [videos, setVideos] = useState<VideoUpload[]>([]);
  const [highlights, setHighlights] = useState<VideoHighlight[]>([]);
  const [reels, setReels] = useState<RecruitmentReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getVideos(studentId), getHighlights(studentId), getRecruitmentReels(studentId)])
      .then(([v, h, r]) => {
        setVideos(v.data);
        setHighlights(h.data);
        setReels(r.data);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [studentId]);

  useEffect(load, [load]);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    const fd = new FormData();
    fd.append('file', f);
    fd.append('video_type', 'other');
    fd.append('title', f.name);
    uploadVideo(studentId, fd)
      .then(() => {
        setToast(t('sportsPage.uploadedOk'));
        setTimeout(() => setToast(''), 3500);
        load();
      })
      .catch(setError)
      .finally(() => setBusy(false));
  };

  return (
    <QueryBoundary loading={loading} error={error} onRetry={load}>
      {toast && (
        <p className={cn('mb-4 rounded-xl border px-4 py-2 text-sm', A.soft, A.border, A.text)}>{toast}</p>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button
          className={cn('min-touch rounded-full text-white', A.bg)}
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4" /> {busy ? t('sportsPage.uploading') : t('sportsPage.uploadBtn')}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          className="hidden"
          aria-label={t('sportsPage.uploadBtn')}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Badge variant="outline" className="gap-1 border-dashed">
          <Sparkles className="h-3.5 w-3.5" /> {t('sportsPage.aiPlaceholder')}
        </Badge>
      </div>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold">{t('sportsPage.videosTitle')}</h3>
        {videos.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t('sportsPage.noVideos')}</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <li key={v.video_id} className="rounded-xl border p-3">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <p className="truncate text-sm font-medium">{v.title ?? v.original_filename}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {v.video_type} · {v.duration_formatted ?? '—'} · {v.event_date ? fmtDate(v.event_date, lang) : ''}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{v.processing_status}</Badge>
                  <Badge variant="outline" className="text-[10px]">{v.privacy_setting}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">{t('sportsPage.highlightsTitle')}</h3>
          {highlights.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t('sportsPage.noHighlights')}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {highlights.map((h) => (
                <li key={h.highlight_id} className="flex items-center gap-2 text-sm">
                  <Play className="h-3.5 w-3.5 shrink-0 text-gold-deep" aria-hidden />
                  <span className="font-medium">{h.title ?? h.highlight_type}</span>
                  <span className="text-xs text-muted-foreground">
                    {h.start_timestamp}–{h.end_timestamp}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">{t('sportsPage.reelsTitle')}</h3>
          {reels.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t('sportsPage.noReels')}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {reels.map((r) => (
                <li key={r.reel_id} className="rounded-xl border p-3 text-sm">
                  <p className="font-medium">{r.reel_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.highlight_count ?? r.included_highlights.length} highlights · {r.status}
                    {r.target_audience ? ` · ${r.target_audience}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </QueryBoundary>
  );
}

/* ---------------------------- Timeline tab ----------------------------- */

const SOURCE_LABEL: Record<PerformancePoint['source'], string> = {
  video_analysis: 'sportsPage.srcVideo',
  racing360: 'sportsPage.srcRacing',
  coach_entry: 'sportsPage.srcCoach',
};

function TimelineTab({ studentId }: { studentId: string }) {
  const { t, lang } = useI18n();
  const [points, setPoints] = useState<PerformancePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(() => {
    setLoading(true);
    getPerformanceTimeline(studentId)
      .then((r) => setPoints(r.data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [studentId]);

  useEffect(load, [load]);

  const chartData = useMemo(
    () =>
      points.map((p) => ({
        date: fmtDate(p.assessment_date, lang),
        [t('sportsPage.overall')]: p.overall_rating,
        [t('sportsPage.technical')]: p.technical_skills,
        [t('sportsPage.tactical')]: p.tactical_awareness,
        [t('sportsPage.physical')]: p.physical_fitness,
      })),
    [points, lang, t],
  );

  return (
    <QueryBoundary loading={loading} error={error} onRetry={load} isEmpty={points.length === 0} emptyLabel={t('sportsPage.timelineEmpty')}>
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <LineChartIcon className="h-4 w-4" aria-hidden /> {t('sportsPage.timelineTitle')}
        </h3>
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey={t('sportsPage.overall')} stroke="#C9A961" strokeWidth={2.5} dot />
              <Line type="monotone" dataKey={t('sportsPage.technical')} stroke="#0B0B0B" strokeWidth={1.5} dot />
              <Line type="monotone" dataKey={t('sportsPage.tactical')} stroke="#7c8a3a" strokeWidth={1.5} dot />
              <Line type="monotone" dataKey={t('sportsPage.physical')} stroke="#5b7fa6" strokeWidth={1.5} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <ul className="mt-4 space-y-3">
        {[...points].reverse().map((p) => (
          <li key={p.timeline_id} className="rounded-2xl border bg-card p-4 text-sm shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{fmtDate(p.assessment_date, lang)}{p.season ? ` · ${p.season}` : ''}</p>
              <Badge variant="secondary">{t(SOURCE_LABEL[p.source])}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {p.overall_rating != null && <span>{t('sportsPage.overall')} {p.overall_rating}</span>}
              {p.technical_skills != null && <span>{t('sportsPage.technical')} {p.technical_skills}</span>}
              {p.tactical_awareness != null && <span>{t('sportsPage.tactical')} {p.tactical_awareness}</span>}
              {p.trajectory && <span>{p.trajectory}</span>}
            </div>
            {p.assessment_notes && <p className="mt-2 text-muted-foreground">{p.assessment_notes}</p>}
            {p.coach_observations && (
              <p className="mt-1 text-muted-foreground">“{p.coach_observations}”</p>
            )}
          </li>
        ))}
      </ul>
    </QueryBoundary>
  );
}

/* --------------------- Reports tab (Racing 360) ------------------------ */

function ReportsTab({ studentId, canCoach }: { studentId: string; canCoach: boolean }) {
  const { t, lang } = useI18n();
  const [reports, setReports] = useState<Racing360Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [toast, setToast] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileDate, setFileDate] = useState(new Date().toISOString().slice(0, 10));
  const [busyFile, setBusyFile] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getRacing360Reports(studentId)
      .then((r) => setReports(r.data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [studentId]);

  useEffect(load, [load]);

  const flash = (key: string) => {
    setToast(t(key));
    setTimeout(() => setToast(''), 3500);
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    setBusyFile(true);
    importRacing360File(studentId, f, fileDate)
      .then(() => {
        flash('sportsPage.importedOk');
        load();
      })
      .catch(setError)
      .finally(() => setBusyFile(false));
  };

  return (
    <QueryBoundary loading={loading} error={error} onRetry={load}>
      {toast && (
        <p className={cn('mb-4 rounded-xl border px-4 py-2 text-sm', A.soft, A.border, A.text)}>{toast}</p>
      )}

      {/* Direct connection — coming soon */}
      <section className="rounded-2xl border-2 border-dashed border-gold/60 bg-gold-soft/30 p-5">
        <div className="flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-gold-deep" aria-hidden />
          <h3 className="text-sm font-semibold">{t('sportsPage.connectSoonTitle')}</h3>
          <Badge variant="outline" className="ml-auto border-dashed text-[10px]">
            {t('sportsPage.fieldConfirm')}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t('sportsPage.connectSoonBody')}</p>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* File import */}
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <FileUp className="h-4 w-4" aria-hidden /> {t('sportsPage.importTitle')}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{t('sportsPage.importHint')}</p>
          <div className="mt-3">
            <Label htmlFor="r360-date">{t('sportsPage.reportDate')}</Label>
            <Input id="r360-date" type="date" value={fileDate} onChange={(e) => setFileDate(e.target.value)} />
          </div>
          <Button
            className={cn('mt-3 min-touch rounded-full text-white', A.bg)}
            disabled={busyFile}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" /> {t('sportsPage.importBtn')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.csv,image/*"
            className="hidden"
            aria-label={t('sportsPage.importBtn')}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </section>

        {/* Manual metrics — coach only */}
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ClipboardList className="h-4 w-4" aria-hidden /> {t('sportsPage.manualTitle')}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{t('sportsPage.manualHint')}</p>
          {canCoach ? (
            <ManualMetricsForm
              studentId={studentId}
              onSaved={() => {
                flash('sportsPage.metricsSaved');
                load();
              }}
            />
          ) : (
            <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
              {t('sportsPage.coachOnly')}
            </p>
          )}
        </section>
      </div>

      {/* Report list */}
      <section className="mt-4 rounded-2xl border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold">{t('sportsPage.reportListTitle')}</h3>
        {reports.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t('sportsPage.noReports')}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {[...reports].reverse().map((r) => (
              <li key={r.report_id} className="rounded-xl border p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{fmtDate(r.report_date, lang)}</p>
                  <Badge variant="secondary">{r.source}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {r.metrics.sessions != null && <span>{t('sportsPage.fSessions')}: {r.metrics.sessions}</span>}
                  {r.metrics.minutes_played != null && <span>{t('sportsPage.fMinutes')}: {r.metrics.minutes_played}</span>}
                  {r.metrics.sprint_30m_sec != null && <span>{t('sportsPage.fSprint')}: {r.metrics.sprint_30m_sec}</span>}
                  {r.metrics.technical_rating_1_10 != null && <span>{t('sportsPage.technical')}: {r.metrics.technical_rating_1_10}</span>}
                  {r.metrics.tactical_rating_1_10 != null && <span>{t('sportsPage.tactical')}: {r.metrics.tactical_rating_1_10}</span>}
                </div>
                {typeof r.metrics.evaluator_comment === 'string' && r.metrics.evaluator_comment && (
                  <p className="mt-2 text-muted-foreground">“{r.metrics.evaluator_comment}”</p>
                )}
                {r.coach_notes && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('sportsPage.coachNotes')}: {r.coach_notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </QueryBoundary>
  );
}

function ManualMetricsForm({ studentId, onSaved }: { studentId: string; onSaved: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    report_date: new Date().toISOString().slice(0, 10),
    sessions: '',
    minutes_played: '',
    sprint_30m_sec: '',
    technical_rating_1_10: '',
    tactical_rating_1_10: '',
    evaluator_comment: '',
    coach_notes: '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const num = (v: string) => (v === '' ? undefined : Number(v));

  const save = () => {
    setBusy(true);
    enterRacing360Metrics(studentId, {
      report_date: form.report_date,
      sessions: num(form.sessions),
      minutes_played: num(form.minutes_played),
      sprint_30m_sec: num(form.sprint_30m_sec),
      technical_rating_1_10: num(form.technical_rating_1_10),
      tactical_rating_1_10: num(form.tactical_rating_1_10),
      evaluator_comment: form.evaluator_comment || undefined,
      coach_notes: form.coach_notes || undefined,
    })
      .then(onSaved)
      .catch(() => {})
      .finally(() => setBusy(false));
  };

  const fields: Array<{ key: keyof typeof form; label: string; num?: boolean }> = [
    { key: 'sessions', label: t('sportsPage.fSessions'), num: true },
    { key: 'minutes_played', label: t('sportsPage.fMinutes'), num: true },
    { key: 'sprint_30m_sec', label: t('sportsPage.fSprint'), num: true },
    { key: 'technical_rating_1_10', label: t('sportsPage.fTech'), num: true },
    { key: 'tactical_rating_1_10', label: t('sportsPage.fTactical'), num: true },
  ];

  return (
    <div className="mt-3 space-y-3">
      <div>
        <Label htmlFor="m-date">{t('sportsPage.reportDate')}</Label>
        <Input id="m-date" type="date" value={form.report_date} onChange={set('report_date')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.key}>
            <Label htmlFor={`m-${f.key}`}>{f.label}</Label>
            <Input
              id={`m-${f.key}`}
              inputMode={f.num ? 'decimal' : undefined}
              value={form[f.key]}
              onChange={set(f.key)}
            />
          </div>
        ))}
      </div>
      <div>
        <Label htmlFor="m-eval">{t('sportsPage.fEval')}</Label>
        <Textarea id="m-eval" rows={2} value={form.evaluator_comment} onChange={set('evaluator_comment')} />
      </div>
      <div>
        <Label htmlFor="m-notes">{t('sportsPage.fCoachNotes')}</Label>
        <Textarea id="m-notes" rows={2} value={form.coach_notes} onChange={set('coach_notes')} />
      </div>
      <p className="text-[11px] italic text-muted-foreground">{t('sportsPage.fieldConfirm')}</p>
      <Button className={cn('min-touch rounded-full text-white', A.bg)} disabled={busy} onClick={save}>
        {t('sportsPage.saveMetrics')}
      </Button>
    </div>
  );
}

/* -------------------------- Opportunities tab -------------------------- */

const LANES: OpportunityLane[] = ['college', 'national', 'international'];

function OpportunitiesTab() {
  const { t, lang } = useI18n();
  const [opps, setOpps] = useState<SportOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    listOpportunities()
      .then((r) => setOpps(r.data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  const laneLabel: Record<OpportunityLane, string> = {
    college: t('sportsPage.laneCollege'),
    national: t('sportsPage.laneNational'),
    international: t('sportsPage.laneInternational'),
  };

  return (
    <QueryBoundary loading={loading} error={error}>
      {LANES.map((lane) => (
        <section key={lane} className="mb-6">
          <h3 className="font-display text-lg font-bold">{laneLabel[lane]}</h3>
          {(lane === 'national' || lane === 'international') && <RulesBox />}
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {opps.filter((o) => o.lane === lane).map((o) => (
              <article key={o.opportunity_id} className="flex flex-col rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold leading-tight">
                    {lang === 'es' ? o.title_es : o.title_en}
                  </h4>
                  <Badge variant="outline" className="shrink-0 text-[10px]">{t('sportsPage.sampleTag')}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{o.org_name}</p>
                <p className="mt-1 text-xs font-medium">{lang === 'es' ? o.level_es : o.level_en}</p>
                <dl className="mt-3 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    <span>{t('sportsPage.ages', { min: o.age_min, max: o.age_max })}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    <span>{lang === 'es' ? o.location_es : o.location_en}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    <span>{lang === 'es' ? o.dates_es : o.dates_en}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CircleDollarSign className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    <span>
                      {o.cost_usd === 0 || o.cost_usd === null
                        ? t('sportsPage.free')
                        : `$${o.cost_usd.toLocaleString()}`}
                    </span>
                  </div>
                </dl>
                {(o.cost_note_en || o.cost_note_es) && (
                  <p className="mt-1.5 text-[11px] italic text-muted-foreground">
                    {lang === 'es' ? o.cost_note_es ?? o.cost_note_en : o.cost_note_en}
                  </p>
                )}
                <div className="mt-3">
                  <p className="text-xs font-semibold">{t('sportsPage.requirements')}</p>
                  <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                    {(lang === 'es' ? o.requirements_es : o.requirements_en).map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </QueryBoundary>
  );
}

function RulesBox() {
  const { t } = useI18n();
  return (
    <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="font-semibold">{t('sportsPage.rulesTitle')}</p>
      <p className="mt-0.5 text-xs leading-relaxed">{t('sportsPage.rulesBody')}</p>
    </div>
  );
}

/* ------------------------- Scout view (partner) ------------------------ */

function ScoutView() {
  const { t } = useI18n();
  const [position, setPosition] = useState('');
  const [gradYear, setGradYear] = useState('');
  const [level, setLevel] = useState('');
  const [openTo, setOpenTo] = useState('');
  const [results, setResults] = useState<ScoutResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [reqFor, setReqFor] = useState<ScoutResult | null>(null);
  const [toast, setToast] = useState('');

  const run = useCallback(() => {
    setLoading(true);
    setError(null);
    searchRecruitingProfiles({
      position: position || undefined,
      grad_year: gradYear ? Number(gradYear) : undefined,
      level: level || undefined,
      open_to: openTo || undefined,
    })
      .then((r) => setResults(r.data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [position, gradYear, level, openTo]);

  useEffect(() => {
    // Initial unfiltered load.
    searchRecruitingProfiles()
      .then((r) => setResults(r.data))
      .catch(setError)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const years = [2027, 2028, 2029, 2030, 2031];
  const levels = ['Recreational', 'Select', 'Premier', 'Academy'];
  const openTos = ['rgv', 'texas', 'us', 'mexico', 'spain', 'other_country'];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <GraduationCap className={cn('h-7 w-7', A.text)} />
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{t('sportsPage.scoutTitle')}</h1>
        </div>
        <p className="mt-2 max-w-2xl rounded-xl border border-gold/50 bg-gold-soft/40 p-3 text-sm text-muted-foreground">
          {t('sportsPage.scoutNote')}
        </p>
      </header>

      {toast && (
        <p className={cn('mb-4 rounded-xl border px-4 py-2 text-sm', A.soft, A.border, A.text)}>{toast}</p>
      )}

      {/* Filters */}
      <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-5">
        <div>
          <Label htmlFor="sc-pos">{t('sportsPage.fPosition')}</Label>
          <Input id="sc-pos" value={position} onChange={(e) => setPosition(e.target.value)} placeholder={t('sportsPage.fPositionPh')} />
        </div>
        <div>
          <Label>{t('sportsPage.fGradYear')}</Label>
          <Select value={gradYear} onValueChange={setGradYear}>
            <SelectTrigger className="min-touch"><SelectValue placeholder={t('sportsPage.any')} /></SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t('sportsPage.fLevel')}</Label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="min-touch"><SelectValue placeholder={t('sportsPage.any')} /></SelectTrigger>
            <SelectContent>
              {levels.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t('sportsPage.fOpenTo')}</Label>
          <Select value={openTo} onValueChange={setOpenTo}>
            <SelectTrigger className="min-touch"><SelectValue placeholder={t('sportsPage.any')} /></SelectTrigger>
            <SelectContent>
              {openTos.map((o) => (
                <SelectItem key={o} value={o}>{t(`openTo.${o}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button className={cn('min-touch w-full rounded-full text-white', A.bg)} onClick={run}>
            {t('sportsPage.search')}
          </Button>
        </div>
      </div>

      <QueryBoundary loading={loading} error={error} onRetry={run}>
        {results && (
          <>
            <p className="mt-4 text-sm text-muted-foreground">{t('sportsPage.results', { count: results.length })}</p>
            {results.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{t('sportsPage.noResults')}</p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((r) => (
                  <article key={r.student_id} className="rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display text-base font-bold">{r.display_name}</p>
                      {r.under_18 && <Badge variant="outline" className="text-[10px]">{t('sportsPage.under18Tag')}</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.sport} · {t('sportsPage.gradYear')} {r.grad_year ?? '—'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.positions.map((p) => (
                        <Badge key={p} variant="secondary">{p}</Badge>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {r.competitive_level ?? ''} {r.team_name ? `· ${r.team_name}` : ''}
                      {r.height_inches ? ` · ${fmtHeight(r.height_inches)}` : ''}
                      {r.overall_rating != null ? ` · ${t('sportsPage.overall')} ${r.overall_rating}` : ''}
                    </p>
                    {r.open_to.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('sportsPage.openIn')}
                        {r.open_to.map((o) => t(`openTo.${o}`)).join(', ')}
                      </p>
                    )}
                    <Button
                      size="sm"
                      className={cn('mt-3 min-touch w-full rounded-full text-white', A.bg)}
                      onClick={() => setReqFor(r)}
                    >
                      {t('sportsPage.requestContact')}
                    </Button>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </QueryBoundary>

      <RequestContactDialog
        result={reqFor}
        onClose={() => setReqFor(null)}
        onSent={(under18) => {
          setReqFor(null);
          setToast(t(under18 ? 'sportsPage.reqSentParent' : 'sportsPage.reqSentStudent'));
          setTimeout(() => setToast(''), 4000);
        }}
      />
    </div>
  );
}

function RequestContactDialog({
  result,
  onClose,
  onSent,
}: {
  result: ScoutResult | null;
  onClose: () => void;
  onSent: (under18: boolean) => void;
}) {
  const { t } = useI18n();
  const [org, setOrg] = useState('');
  const [role, setRole] = useState<ContactRequest['requester_role']>('college');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (result) {
      setOrg('');
      setMessage('');
      setRole('college');
    }
  }, [result]);

  const send = () => {
    if (!result) return;
    setBusy(true);
    requestContact(result.student_id, { requester_org: org, requester_role: role, message })
      .then(() => onSent(result.under_18))
      .catch(() => {})
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open={!!result} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('sportsPage.reqTitle', { name: result?.display_name ?? '' })}</DialogTitle>
          <DialogDescription>{t('sportsPage.scoutNote')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="rc-org">{t('sportsPage.reqOrg')}</Label>
            <Input id="rc-org" value={org} onChange={(e) => setOrg(e.target.value)} />
          </div>
          <div>
            <Label>{t('sportsPage.reqRole')}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as ContactRequest['requester_role'])}>
              <SelectTrigger className="min-touch"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="college">{t('sportsPage.roleCollege')}</SelectItem>
                <SelectItem value="pro_club">{t('sportsPage.roleProClub')}</SelectItem>
                <SelectItem value="employer">{t('sportsPage.roleEmployer')}</SelectItem>
                <SelectItem value="training_school">{t('sportsPage.roleTraining')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="rc-msg">{t('sportsPage.reqMessage')}</Label>
            <Textarea id="rc-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('sportsPage.reqMessagePh')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="min-touch rounded-full" onClick={onClose}>{t('sportsPage.cancel')}</Button>
          <Button
            className={cn('min-touch rounded-full text-white', A.bg)}
            disabled={busy || !org.trim() || !message.trim()}
            onClick={send}
          >
            {t('sportsPage.reqSend')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- Explorer lite ------------------------------ */

function SportsExplorerLite() {
  const { t, lang } = useI18n();
  const [opps, setOpps] = useState<SportOpportunity[]>([]);

  useEffect(() => {
    listOpportunities().then((r) => setOpps(r.data)).catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-2">
        <Trophy className={cn('h-7 w-7', A.text)} />
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{t('sportsPage.title')}</h1>
      </div>
      <p className="mt-3 rounded-2xl border-2 border-gold/50 bg-gold-soft/50 p-4 text-sm">
        {t('sportsPage.explorerNote')}
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {opps.slice(0, 6).map((o) => (
          <article key={o.opportunity_id} className="rounded-xl border bg-card p-3 shadow-sm">
            <p className="text-sm font-semibold leading-tight">{lang === 'es' ? o.title_es : o.title_en}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{lang === 'es' ? o.location_es : o.location_en}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('sportsPage.ages', { min: o.age_min, max: o.age_max })}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
