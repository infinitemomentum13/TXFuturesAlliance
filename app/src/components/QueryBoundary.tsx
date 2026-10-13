import type { ReactNode } from 'react';
import { useI18n } from '@/i18n';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { TriangleAlert, WifiOff, Lock, SearchX } from 'lucide-react';

/**
 * One place for loading / error / empty states, as required: every screen
 * that fetches wraps its content in this.
 */
export function QueryBoundary({
  loading,
  error,
  isEmpty,
  onRetry,
  emptyLabel,
  children,
}: {
  loading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  onRetry?: () => void;
  emptyLabel?: string;
  children: ReactNode;
}) {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground" role="status">
        <Spinner className="size-5" />
        <span>{t('app.loading')}</span>
      </div>
    );
  }

  if (error) {
    const status = error instanceof ApiRequestError ? error.status : -1;
    const msg =
      status === 0
        ? t('app.errorNetwork')
        : status === 403
          ? t('app.errorForbidden')
          : status === 404
            ? t('app.errorNotFound')
            : t('app.errorTitle');
    const Icon = status === 0 ? WifiOff : status === 403 ? Lock : status === 404 ? SearchX : TriangleAlert;
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Icon className="size-8 text-gold-deep" aria-hidden />
        <p className="max-w-sm text-sm text-muted-foreground">{msg}</p>
        {onRetry && (
          <Button variant="outline" className="min-touch rounded-full" onClick={onRetry}>
            {t('app.retry')}
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        {emptyLabel ?? t('app.empty')}
      </div>
    );
  }

  return <>{children}</>;
}
