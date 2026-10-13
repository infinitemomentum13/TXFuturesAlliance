/**
 * Profile — editable, mapped to the SQL/OpenAPI shapes:
 * basics → students; grades → academic_records; test scores →
 * standardized_test_scores (addition); sports → athletic_profiles;
 * interests → career_interests (addition); documents → student_documents
 * (addition, metadata only in this phase).
 */
import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import { getSession } from '@/api/auth';
import {
  addDocument,
  addTestScore,
  createAcademicRecord,
  createAthleticProfile,
  deleteDocument,
  getAcademicRecords,
  getAthleticProfiles,
  getDocuments,
  getInterests,
  getStudent,
  getTestScores,
  updateAthleticProfile,
  updateInterests,
  updateStudent,
} from '@/api';
import type {
  AcademicRecord,
  AppStudent,
  AthleticProfile,
  CareerInterest,
  CompetitiveLevel,
  InterestKey,
  StudentDocument,
  TestScore,
} from '@/api/types';
import { QueryBoundary } from '@/components/QueryBoundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

const INTEREST_KEYS: InterestKey[] = [
  'hands_on', 'helping_people', 'tech', 'building', 'outdoors', 'business', 'health', 'art', 'sports',
];
const LEVELS: CompetitiveLevel[] = ['Recreational', 'Select', 'Premier', 'Academy', 'Professional'];
const LEVEL_I18N: Record<CompetitiveLevel, string> = {
  Recreational: 'profile.levelRecreational',
  Select: 'profile.levelSelect',
  Premier: 'profile.levelPremier',
  Academy: 'profile.levelAcademy',
  Professional: 'profile.levelProfessional',
};
const SOURCE_I18N: Record<string, string> = {
  self_reported: 'profile.sourceSelf',
  uploaded_verified: 'profile.sourceUploaded',
  school_import_pending: 'profile.sourceSchool',
};

export default function Profile() {
  const { t } = useI18n();
  const studentId = getSession()?.user.student_id;
  const [student, setStudent] = useState<AppStudent | null>(null);
  const [records, setRecords] = useState<AcademicRecord[]>([]);
  const [scores, setScores] = useState<TestScore[]>([]);
  const [profiles, setProfiles] = useState<AthleticProfile[]>([]);
  const [interests, setInterests] = useState<CareerInterest[]>([]);
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');

  const load = () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      getStudent(studentId),
      getAcademicRecords(studentId),
      getTestScores(studentId),
      getAthleticProfiles(studentId),
      getInterests(studentId),
      getDocuments(studentId),
    ])
      .then(([s, rec, ts, ap, ints, docs]) => {
        setStudent(s);
        setRecords(rec.data);
        setScores(ts.data);
        setProfiles(ap.data);
        setInterests(ints.data);
        setDocuments(docs.data);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [studentId]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 2500);
  };

  return (
    <QueryBoundary loading={loading} error={error} onRetry={load}>
      {student && (
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl font-extrabold tracking-tight">{t('profile.title')}</h1>
            {student.is_sample && <Badge variant="outline" className="text-[10px]">{t('app.sampleBadge')}</Badge>}
            {notice && <Badge className="bg-gold-soft text-gold-deep">{notice}</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('profile.subtitle')}</p>

          <Tabs defaultValue="basics" className="mt-6">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
              {(['basics', 'academics', 'sports', 'interests', 'documents'] as const).map((k) => (
                <TabsTrigger key={k} value={k} className="min-touch rounded-full px-4 text-sm">
                  {t(`profile.${k}`)}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="basics" className="mt-5">
              <BasicsTab student={student} onSaved={(s) => { setStudent(s); flash(t('profile.savedOk')); }} />
            </TabsContent>
            <TabsContent value="academics" className="mt-5">
              <AcademicsTab studentId={student.student_id} records={records} scores={scores} onChanged={() => { load(); flash(t('profile.savedOk')); }} onError={setError} />
            </TabsContent>
            <TabsContent value="sports" className="mt-5">
              <SportsTab studentId={student.student_id} profiles={profiles} onChanged={() => { load(); flash(t('profile.savedOk')); }} onError={setError} />
            </TabsContent>
            <TabsContent value="interests" className="mt-5">
              <InterestsTab studentId={student.student_id} interests={interests} onChanged={(rows) => { setInterests(rows); flash(t('profile.savedOk')); }} onError={setError} />
            </TabsContent>
            <TabsContent value="documents" className="mt-5">
              <DocumentsTab studentId={student.student_id} documents={documents} onChanged={() => { load(); flash(t('profile.savedOk')); }} onError={setError} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </QueryBoundary>
  );
}

/* ------------------------------ Basics --------------------------------- */

function BasicsTab({ student, onSaved }: { student: AppStudent; onSaved: (s: AppStudent) => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    first_name: student.first_name,
    last_name: student.last_name,
    preferred_name: student.preferred_name ?? '',
    primary_language: student.primary_language ?? '',
    current_grade_level: student.current_grade_level ?? ('' as number | ''),
    school_name: student.school_name ?? '',
    city: student.address?.city ?? '',
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    const updated = await updateStudent(student.student_id, {
      first_name: form.first_name,
      last_name: form.last_name,
      preferred_name: form.preferred_name || null,
      primary_language: form.primary_language || null,
      current_grade_level: form.current_grade_level === '' ? null : Number(form.current_grade_level),
      school_name: form.school_name || null,
      address: { ...student.address, city: form.city },
    } as Partial<AppStudent>);
    onSaved({ ...student, ...(updated as Partial<AppStudent>) } as AppStudent);
  };

  const field = (key: keyof typeof form, labelKey: string, type = 'text') => (
    <div>
      <Label htmlFor={`pf-${key}`}>{t(labelKey)}</Label>
      <Input id={`pf-${key}`} type={type} className="mt-1.5 min-touch" value={form[key]} onChange={set(key)} />
    </div>
  );

  return (
    <div className="grid max-w-xl gap-4 rounded-2xl border-2 border-border bg-card p-5 sm:grid-cols-2">
      {field('first_name', 'profile.firstName')}
      {field('last_name', 'profile.lastName')}
      {field('preferred_name', 'profile.preferredName')}
      <div>
        <Label>{t('profile.dob')}</Label>
        <Input className="mt-1.5 min-touch" value={student.date_of_birth ?? ''} disabled />
      </div>
      {field('grade' in form ? 'current_grade_level' : 'current_grade_level', 'profile.grade', 'number')}
      {field('school_name', 'profile.school')}
      {field('city', 'profile.city')}
      {field('primary_language', 'profile.language')}
      <div className="sm:col-span-2">
        <Button className="min-touch rounded-full" onClick={() => void save().catch(() => undefined)}>{t('app.save')}</Button>
      </div>
    </div>
  );
}

/* ---------------------------- Academics -------------------------------- */

function AcademicsTab({
  studentId,
  records,
  scores,
  onChanged,
  onError,
}: {
  studentId: string;
  records: AcademicRecord[];
  scores: TestScore[];
  onChanged: () => void;
  onError: (e: unknown) => void;
}) {
  const { t } = useI18n();
  const [addingRecord, setAddingRecord] = useState(false);
  const [year, setYear] = useState('2026-2027');
  const [semester, setSemester] = useState('Fall');
  const [gpa, setGpa] = useState('');
  const [addingScore, setAddingScore] = useState(false);
  const [testType, setTestType] = useState<TestScore['test_type']>('SAT');
  const [testDate, setTestDate] = useState('');
  const [scoreValue, setScoreValue] = useState('');

  const submitRecord = async () => {
    try {
      await createAcademicRecord(studentId, {
        school_year: year,
        semester,
        course_name: t('profile.gpaSummaryCourse'),
        gpa_semester: Number(gpa),
        gpa_cumulative: Number(gpa),
        source_system: 'Manual',
      });
      setAddingRecord(false);
      setGpa('');
      onChanged();
    } catch (e) {
      onError(e);
    }
  };

  const submitScore = async () => {
    try {
      const body: Partial<TestScore> = { test_type: testType, test_date: testDate };
      if (testType === 'SAT') body.sat_total = Number(scoreValue);
      else if (testType === 'ACT') body.act_composite = Number(scoreValue);
      else if (testType === 'TOEFL') body.toefl_total = Number(scoreValue);
      else body.score_value = Number(scoreValue);
      await addTestScore(studentId, body);
      setAddingScore(false);
      setScoreValue('');
      onChanged();
    } catch (e) {
      onError(e);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <section className="rounded-2xl border-2 border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{t('profile.gradesByTerm')}</h2>
          <Button variant="outline" size="sm" className="min-touch rounded-full" onClick={() => setAddingRecord((v) => !v)}>
            {t('profile.addTerm')}
          </Button>
        </div>
        <ul className="mt-3 space-y-2">
          {records.map((r) => (
            <li key={r.record_id} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
              <span className="font-medium">{r.school_year} · {r.semester}</span>
              <span className="flex items-center gap-2">
                <span className="font-display text-base font-bold">{r.gpa_semester?.toFixed(2)}</span>
                <Badge variant="outline" className="text-[10px]">{t(SOURCE_I18N[r.grade_source ?? 'self_reported'])}</Badge>
              </span>
            </li>
          ))}
          {records.length === 0 && <li className="text-sm text-muted-foreground">{t('app.empty')}</li>}
        </ul>
        {addingRecord && (
          <div className="mt-4 grid gap-3 rounded-xl bg-muted/50 p-4 sm:grid-cols-4">
            <div>
              <Label>{t('profile.term')}</Label>
              <Input className="mt-1 min-touch" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2026-2027" />
            </div>
            <div>
              <Label>&nbsp;</Label>
              <select className="mt-1 min-touch w-full rounded-xl border bg-card px-3 text-sm" value={semester} onChange={(e) => setSemester(e.target.value)}>
                <option value="Fall">{t('profile.fall')}</option>
                <option value="Spring">{t('profile.spring')}</option>
              </select>
            </div>
            <div>
              <Label>{t('profile.termGpa')}</Label>
              <Input className="mt-1 min-touch" type="number" step="0.01" min="0" max="4" value={gpa} onChange={(e) => setGpa(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button className="min-touch rounded-full" disabled={!gpa} onClick={() => void submitRecord()}>{t('app.save')}</Button>
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-4">{t('profile.sourceSelf')}</p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border-2 border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{t('profile.testScores')}</h2>
          <Button variant="outline" size="sm" className="min-touch rounded-full" onClick={() => setAddingScore((v) => !v)}>
            {t('profile.addScore')}
          </Button>
        </div>
        <ul className="mt-3 space-y-2">
          {scores.map((s) => (
            <li key={s.score_id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
              <span className="font-medium">{s.test_type} · {s.test_date}</span>
              <span className="font-display text-base font-bold">
                {s.sat_total ?? s.act_composite ?? s.toefl_total ?? s.score_value ?? '—'}
              </span>
            </li>
          ))}
          {scores.length === 0 && <li className="text-sm text-muted-foreground">{t('profile.noScores')}</li>}
        </ul>
        {addingScore && (
          <div className="mt-4 grid gap-3 rounded-xl bg-muted/50 p-4 sm:grid-cols-4">
            <div>
              <Label>{t('profile.testType')}</Label>
              <select className="mt-1 min-touch w-full rounded-xl border bg-card px-3 text-sm" value={testType} onChange={(e) => setTestType(e.target.value as TestScore['test_type'])}>
                {['SAT', 'ACT', 'PSAT', 'TOEFL', 'TSIA2', 'other'].map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div>
              <Label>{t('profile.testDate')}</Label>
              <Input className="mt-1 min-touch" type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} />
            </div>
            <div>
              <Label>{t('profile.scoreLabel')}</Label>
              <Input className="mt-1 min-touch" type="number" value={scoreValue} onChange={(e) => setScoreValue(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button className="min-touch rounded-full" disabled={!testDate || !scoreValue} onClick={() => void submitScore()}>{t('app.save')}</Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------ Sports --------------------------------- */

function SportsTab({
  studentId,
  profiles,
  onChanged,
  onError,
}: {
  studentId: string;
  profiles: AthleticProfile[];
  onChanged: () => void;
  onError: (e: unknown) => void;
}) {
  const { t } = useI18n();
  const p = profiles[0];
  const [form, setForm] = useState({
    position: p?.position ?? '',
    team_name: p?.team_name ?? '',
    competitive_level: (p?.competitive_level ?? 'Recreational') as CompetitiveLevel,
    years_experience: p?.years_experience ?? ('' as number | ''),
    dominant_foot: p?.dominant_foot ?? '',
  });

  const save = async () => {
    try {
      const body = {
        sport: 'Soccer',
        position: form.position || null,
        team_name: form.team_name || null,
        competitive_level: form.competitive_level,
        years_experience: form.years_experience === '' ? null : Number(form.years_experience),
        dominant_foot: form.dominant_foot || null,
      };
      if (p) await updateAthleticProfile(studentId, p.profile_id, body);
      else await createAthleticProfile(studentId, body);
      onChanged();
    } catch (e) {
      onError(e);
    }
  };

  return (
    <div className="max-w-xl rounded-2xl border-2 border-sports bg-card p-5">
      {!p && <p className="mb-4 text-sm text-muted-foreground">{t('profile.noSport')}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>{t('profile.sportLabel')}</Label>
          <Input className="mt-1.5 min-touch" value="Soccer" disabled />
        </div>
        <div>
          <Label>{t('profile.positionLabel')}</Label>
          <Input className="mt-1.5 min-touch" value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} />
        </div>
        <div>
          <Label>{t('profile.teamLabel')}</Label>
          <Input className="mt-1.5 min-touch" value={form.team_name} onChange={(e) => setForm((f) => ({ ...f, team_name: e.target.value }))} />
        </div>
        <div>
          <Label>{t('profile.levelLabel')}</Label>
          <select
            className="mt-1.5 min-touch w-full rounded-xl border bg-card px-3 text-sm"
            value={form.competitive_level}
            onChange={(e) => setForm((f) => ({ ...f, competitive_level: e.target.value as CompetitiveLevel }))}
          >
            {LEVELS.map((l) => <option key={l} value={l}>{t(LEVEL_I18N[l])}</option>)}
          </select>
        </div>
        <div>
          <Label>{t('profile.yearsLabel')}</Label>
          <Input className="mt-1.5 min-touch" type="number" min="0" value={form.years_experience} onChange={(e) => setForm((f) => ({ ...f, years_experience: e.target.value as unknown as number }))} />
        </div>
        <div>
          <Label>{t('profile.footLabel')}</Label>
          <select className="mt-1.5 min-touch w-full rounded-xl border bg-card px-3 text-sm" value={form.dominant_foot} onChange={(e) => setForm((f) => ({ ...f, dominant_foot: e.target.value }))}>
            <option value="">—</option>
            <option value="Right">{t('profile.footRight')}</option>
            <option value="Left">{t('profile.footLeft')}</option>
            <option value="Both">{t('profile.footBoth')}</option>
          </select>
        </div>
      </div>
      <Button className="mt-5 min-touch rounded-full" onClick={() => void save()}>{t('app.save')}</Button>
    </div>
  );
}

/* ----------------------------- Interests ------------------------------- */

function InterestsTab({
  studentId,
  interests,
  onChanged,
  onError,
}: {
  studentId: string;
  interests: CareerInterest[];
  onChanged: (rows: CareerInterest[]) => void;
  onError: (e: unknown) => void;
}) {
  const { t } = useI18n();
  const selected = new Set(interests.map((x) => x.career_field));

  const toggle = async (key: InterestKey) => {
    const next = selected.has(key) ? [...selected].filter((x) => x !== key) : [...selected, key];
    try {
      const res = await updateInterests(studentId, next.map((f) => ({ career_field: f, interest_level: 3 })));
      onChanged(res.data);
    } catch (e) {
      onError(e);
    }
  };

  return (
    <div className="max-w-xl rounded-2xl border-2 border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{t('profile.interestsHint')}</p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        {INTEREST_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            className={cn(
              'min-touch rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors',
              selected.has(k) ? 'border-gold bg-gold-soft' : 'border-border hover:border-gold/60',
            )}
            onClick={() => void toggle(k)}
          >
            {t(`interests.${k}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- Documents ------------------------------- */

function DocumentsTab({
  studentId,
  documents,
  onChanged,
  onError,
}: {
  studentId: string;
  documents: StudentDocument[];
  onChanged: () => void;
  onError: (e: unknown) => void;
}) {
  const { t } = useI18n();
  const [kind, setKind] = useState<StudentDocument['kind']>('report_card');
  const KINDS: Array<[StudentDocument['kind'], string]> = [
    ['report_card', 'profile.kindReportCard'],
    ['certificate', 'profile.kindCertificate'],
    ['award', 'profile.kindAward'],
  ];

  const pick = async (fileName?: string) => {
    if (!fileName) return;
    try {
      await addDocument(studentId, { kind, file_name: fileName });
      onChanged();
    } catch (e) {
      onError(e);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteDocument(studentId, id);
      onChanged();
    } catch (e) {
      onError(e);
    }
  };

  return (
    <div className="max-w-xl rounded-2xl border-2 border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{t('profile.documentsHint')}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select className="min-touch rounded-xl border bg-card px-3 text-sm" value={kind} onChange={(e) => setKind(e.target.value as StudentDocument['kind'])}>
          {KINDS.map(([k, key]) => <option key={k} value={k}>{t(key)}</option>)}
        </select>
        <label className="inline-flex min-touch cursor-pointer items-center gap-2 rounded-full border-2 border-gold/60 px-4 text-sm font-semibold text-gold-deep">
          <Upload className="size-4" aria-hidden />
          {t('profile.addDocument')}
          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => void pick(e.target.files?.[0]?.name)} />
        </label>
      </div>
      <ul className="mt-4 space-y-2">
        {documents.map((d) => (
          <li key={d.document_id} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
            <span className="min-w-0 truncate font-medium">{d.file_name}</span>
            <span className="flex shrink-0 items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{t(KINDS.find(([k]) => k === d.kind)?.[1] ?? 'profile.kindReportCard')}</Badge>
              <button type="button" className="min-touch rounded-full p-1.5 text-muted-foreground hover:text-foreground" aria-label={t('profile.delete')} onClick={() => void remove(d.document_id)}>
                <Trash2 className="size-4" />
              </button>
            </span>
          </li>
        ))}
        {documents.length === 0 && <li className="text-sm text-muted-foreground">{t('profile.noDocuments')}</li>}
      </ul>
    </div>
  );
}
