import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useI18n } from '@/i18n';
import { createStudent } from '@/api';
import { signInWithPassword } from '@/api/auth';
import { BrandMark } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

interface ChildForm {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  grade: string;
}

const emptyChild: ChildForm = { first_name: '', last_name: '', date_of_birth: '', grade: '6' };

/** Parent sign-up: creates the parent account first, then adds children
 *  (POST /students with guardian_email — COPPA-ready). Demo: mock only. */
export default function ParentSignup() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [children, setChildren] = useState<ChildForm[]>([{ ...emptyChild }]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const setChild = (i: number, patch: Partial<ChildForm>) =>
    setChildren((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const submit = async () => {
    setBusy(true);
    // Sign the parent in (mock), then register each child with guardian email.
    await signInWithPassword({ email, password, role: 'parent' });
    for (const c of children) {
      if (!c.first_name || !c.last_name || !c.date_of_birth) continue;
      await createStudent({
        first_name: c.first_name,
        last_name: c.last_name,
        date_of_birth: c.date_of_birth,
        current_grade_level: Number(c.grade),
        guardian_email: email,
      });
    }
    setBusy(false);
    setDone(true);
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="px-4 py-4 lg:px-8">
        <BrandMark />
      </header>
      <main className="mx-auto w-full max-w-md px-5 pb-16">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{t('signup.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('signup.subtitle')}</p>

        <div className="mt-6 flex gap-2" aria-hidden>
          <span className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-gold' : 'bg-muted'}`} />
          <span className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-gold' : 'bg-muted'}`} />
        </div>

        {done ? (
          <div className="mt-10 space-y-4 text-center">
            <p className="text-lg font-semibold">{t('signup.created')}</p>
            <Button className="min-touch w-full rounded-full" onClick={() => navigate('/')}>
              {t('nav.home')}
            </Button>
          </div>
        ) : step === 1 ? (
          <div className="mt-8 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-deep">{t('signup.step1')}</p>
            <div className="space-y-2">
              <Label htmlFor="pname">{t('signup.name')}</Label>
              <Input id="pname" className="min-touch" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pemail">{t('signup.email')}</Label>
              <Input id="pemail" type="email" className="min-touch" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ppass">{t('signup.password')}</Label>
              <Input id="ppass" type="password" className="min-touch" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <p className="rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">{t('signup.under13Note')}</p>
            <Button className="min-touch w-full rounded-full" disabled={!name || !email || !password} onClick={() => setStep(2)}>
              {t('app.next')}
            </Button>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-deep">{t('signup.step2')}</p>
            {children.map((c, i) => (
              <div key={i} className="space-y-3 rounded-2xl border p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t('signup.childName')}</Label>
                    <Input className="min-touch" value={c.first_name} onChange={(e) => setChild(i, { first_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('signup.childLastName')}</Label>
                    <Input className="min-touch" value={c.last_name} onChange={(e) => setChild(i, { last_name: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t('signup.childDob')}</Label>
                    <Input type="date" className="min-touch" value={c.date_of_birth} onChange={(e) => setChild(i, { date_of_birth: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('signup.childGrade')}</Label>
                    <Input type="number" min={0} max={12} className="min-touch" value={c.grade} onChange={(e) => setChild(i, { grade: e.target.value })} />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" className="min-touch w-full rounded-full" onClick={() => setChildren((cs) => [...cs, { ...emptyChild }])}>
              + {t('signup.addChild')}
            </Button>
            <div className="flex gap-3">
              <Button variant="ghost" className="min-touch rounded-full" onClick={() => setStep(1)}>
                {t('app.back')}
              </Button>
              <Button className="min-touch flex-1 rounded-full" disabled={busy} onClick={submit}>
                {busy ? <Spinner className="size-4" /> : t('signup.create')}
              </Button>
            </div>
          </div>
        )}
        <p className="mt-8 text-center text-sm">
          <Link to="/login" className="text-gold-deep underline-offset-4 hover:underline">
            ← {t('login.title')}
          </Link>
        </p>
      </main>
    </div>
  );
}
