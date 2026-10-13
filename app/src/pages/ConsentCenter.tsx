import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import { getConsents, getStudent, updateConsents } from '@/api';
import { getSession } from '@/api/auth';
import type { AppStudent, ConsentKey, ConsentRecord } from '@/api/types';
import { QueryBoundary } from '@/components/QueryBoundary';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ShieldCheck, Eye } from 'lucide-react';

const KEYS: Array<{ key: ConsentKey; label: string; desc: string }> = [
  { key: 'grades_for_matching', label: 'consent.grades', desc: 'consent.gradesDesc' },
  { key: 'sports_to_colleges', label: 'consent.colleges', desc: 'consent.collegesDesc' },
  { key: 'sports_to_pro_clubs', label: 'consent.proClubs', desc: 'consent.proClubsDesc' },
  { key: 'videos', label: 'consent.videos', desc: 'consent.videosDesc' },
  { key: 'partner_contact', label: 'consent.partnerContact', desc: 'consent.partnerContactDesc' },
  { key: 'club_player_development', label: 'consent.clubDev', desc: 'consent.clubDevDesc' },
];

/** Consent Center — visible to both student and parent. Every switch starts
 *  OFF; changes persist through the API (PUT /students/{id}/consents). */
export default function ConsentCenter() {
  const { t } = useI18n();
  const session = getSession();
  const role = session?.user.role;
  const childIds = session?.user.child_ids ?? [];

  const [targetId, setTargetId] = useState<string | undefined>(
    role === 'parent' ? childIds[0] : session?.user.student_id,
  );
  const [children, setChildren] = useState<AppStudent[]>([]);
  const [record, setRecord] = useState<ConsentRecord | null>(null);
  const [student, setStudent] = useState<AppStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!targetId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([getConsents(targetId), getStudent(targetId)])
      .then(([c, s]) => {
        setRecord(c);
        setStudent(s);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [targetId]);

  useEffect(load, [load]);

  // Parent: load children for the selector
  useEffect(() => {
    if (role !== 'parent' || childIds.length === 0) return;
    Promise.all(childIds.map((id) => getStudent(id).catch(() => null))).then((rows) =>
      setChildren(rows.filter((r): r is AppStudent => !!r)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const toggle = async (key: ConsentKey, granted: boolean) => {
    if (!targetId || !record) return;
    setSaving(true);
    const next = Object.fromEntries(
      Object.entries(record.consents).map(([k, v]) => [k, k === key ? granted : v.granted]),
    );
    try {
      const updated = await updateConsents(targetId, next);
      setRecord(updated);
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };

  const isMinor = (student?.age ?? 99) < 18;

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-gold-soft">
          <ShieldCheck className="size-7 text-gold-deep" aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{t('consent.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('consent.subtitle')}</p>
        </div>
      </div>

      {role === 'parent' && children.length > 1 && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t('consent.childSelector')}
          </p>
          <div className="flex flex-wrap gap-2">
            {children.map((c) => (
              <button
                key={c.student_id}
                onClick={() => setTargetId(c.student_id)}
                className={`min-touch rounded-full border-2 px-4 py-2 text-sm font-medium ${
                  targetId === c.student_id ? 'border-gold bg-gold-soft' : 'border-border'
                }`}
              >
                {c.first_name} {c.last_name}
              </button>
            ))}
          </div>
        </div>
      )}

      <QueryBoundary loading={loading} error={error} onRetry={load} isEmpty={!targetId && !loading && !error}>
        {record && (
          <div className="mt-8 space-y-1 rounded-2xl border bg-card">
            {KEYS.map(({ key, label, desc }, i) => (
              <div key={key}>
                {i > 0 && <Separator />}
                <div className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{t(label)}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t(desc)}</p>
                    {key === 'club_player_development' && isMinor && role === 'student' && (
                      <p className="mt-1 text-xs font-medium text-gold-deep">{t('consent.clubDevParentNote')}</p>
                    )}
                  </div>
                  <Switch
                    checked={record.consents[key].granted}
                    disabled={saving || (key === 'club_player_development' && isMinor && role === 'student')}
                    onCheckedChange={(v) => void toggle(key, v)}
                    aria-label={t(label)}
                    className="min-touch shrink-0"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {record && (
          <div className="mt-8">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Eye className="size-5 text-gold-deep" aria-hidden />
              {t('consent.whoHasAccess')}
            </h2>
            {record.access_log.length === 0 ? (
              <p className="mt-3 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                {t('consent.noAccess')}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {record.access_log.map((a) => (
                  <li key={a.scope} className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm">
                    <span className="font-medium">{a.party}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('consent.since')} {a.since ? new Date(a.since).toLocaleDateString() : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <p className="mt-8 rounded-2xl border-2 border-gold/60 bg-gold-soft/60 px-5 py-4 text-sm leading-relaxed">
          {t('consent.neverShared')}
        </p>
        {isMinor && <p className="mt-3 text-sm text-muted-foreground">{t('consent.minorNote')}</p>}
      </QueryBoundary>
    </div>
  );
}
