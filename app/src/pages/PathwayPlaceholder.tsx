import { useI18n } from '@/i18n';
import { Badge } from '@/components/ui/badge';
import { Briefcase, GraduationCap, Trophy } from 'lucide-react';
import { ACCENT } from './pathwayAccents';

const META = {
  career: { icon: Briefcase, accent: 'career' as const },
  college: { icon: GraduationCap, accent: 'college' as const },
  sports: { icon: Trophy, accent: 'sports' as const },
};

/** Pathway placeholder screens — full content arrives in the next build steps. */
export default function PathwayPlaceholder({ pathway }: { pathway: keyof typeof META }) {
  const { t } = useI18n();
  const { icon: Icon, accent } = META[pathway];
  const c = ACCENT[accent];
  return (
    <div>
      <div className={`flex items-center gap-3 ${c.text}`}>
        <span className={`grid size-12 place-items-center rounded-2xl ${c.soft}`}>
          <Icon className="size-7" aria-hidden />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">{t('app.tagline')}</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            {t(`pathways.${pathway}`)}
          </h1>
        </div>
      </div>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {t(`pathways.${pathway}Desc`)}
      </p>
      <div className={`mt-8 rounded-2xl border-2 border-dashed ${c.border} ${c.soft} p-10 text-center`}>
        <Badge variant="outline" className="mb-3">{t('app.placeholder')}</Badge>
        <p className="font-display text-lg font-bold">{t(`pathways.${pathway}`)}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('app.comingNext')}</p>
        {/* Photography placeholder — teens in soccer/workshops/campus, marked */}
        <div className="mt-6 grid grid-cols-3 gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed bg-background/60 p-2 text-center text-[10px] text-muted-foreground">
              {t('app.photoPlaceholder')}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
