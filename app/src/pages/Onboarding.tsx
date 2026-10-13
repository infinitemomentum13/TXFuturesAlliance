import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Baby, GraduationCap, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

type Band = 'under13' | 'teen' | 'adult';

/** First-run onboarding: age band first (drives consent rules and
 *  explorer/pathways mode). The Pathway Compass intake is built in the
 *  next step; this screen routes into the app. */
export default function Onboarding() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [band, setBand] = useState<Band | null>(null);

  const options: Array<{ id: Band; icon: typeof Baby; label: string; note: string }> = [
    { id: 'under13', icon: Baby, label: t('onboarding.under13'), note: t('onboarding.under13Note') },
    { id: 'teen', icon: UserRound, label: t('onboarding.teen'), note: t('onboarding.teenNote') },
    { id: 'adult', icon: GraduationCap, label: t('onboarding.adult'), note: t('onboarding.adultNote') },
  ];

  return (
    <main className="mx-auto w-full max-w-lg">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-deep">
        {t('app.name')}
      </p>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">{t('onboarding.title')}</h1>

      <p className="mt-8 text-sm font-semibold">{t('onboarding.ageBand')}</p>
      <div className="mt-3 space-y-3" role="radiogroup" aria-label={t('onboarding.ageBand')}>
        {options.map(({ id, icon: Icon, label, note }) => (
          <button
            key={id}
            role="radio"
            aria-checked={band === id}
            onClick={() => setBand(id)}
            className={cn(
              'flex min-touch w-full items-start gap-4 rounded-2xl border-2 p-4 text-left transition-colors',
              band === id ? 'border-gold bg-gold-soft' : 'border-border bg-card hover:border-gold/50',
            )}
          >
            <Icon className="mt-0.5 size-6 shrink-0 text-gold-deep" aria-hidden />
            <span>
              <span className="block font-display text-base font-bold">{label}</span>
              <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{note}</span>
            </span>
          </button>
        ))}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">{t('onboarding.compassTeaser')}</p>

      <Button
        className="mt-6 min-touch w-full rounded-full"
        disabled={!band}
        onClick={() => navigate('/', { replace: true })}
      >
        {t('onboarding.continue')}
      </Button>
      <Button variant="ghost" className="mt-2 min-touch w-full rounded-full" onClick={() => navigate('/', { replace: true })}>
        {t('app.skip')}
      </Button>
    </main>
  );
}
