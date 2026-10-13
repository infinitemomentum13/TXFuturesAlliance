import { useI18n } from '@/i18n';
import { Badge } from '@/components/ui/badge';

/** Plain-language privacy summary, EN/ES, marked as draft pending legal review. */
export default function Privacy() {
  const { t } = useI18n();
  return (
    <article className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{t('privacy.title')}</h1>
        <Badge variant="outline" className="border-gold text-gold-deep">
          {t('privacy.draft')}
        </Badge>
      </div>
      <div className="mt-6 space-y-4 text-[15px] leading-relaxed">
        <p>{t('privacy.p1')}</p>
        <p>{t('privacy.p2')}</p>
        <p>{t('privacy.p3')}</p>
        <p className="font-semibold">{t('privacy.p4')}</p>
      </div>
    </article>
  );
}
