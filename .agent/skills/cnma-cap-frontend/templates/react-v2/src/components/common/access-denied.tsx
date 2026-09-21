import { ShieldX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@cnma/react-ui';

interface AccessDeniedProps {
    className?: string;
}

/**
 * Full-page or inline Access Denied component.
 * Shown when the user's API call returns 403 Forbidden.
 *
 * Usage:
 *   if (isForbidden(error)) return <AccessDenied />;
 */
export function AccessDenied({ className }: AccessDeniedProps) {
    const { t } = useTranslation();
    return (
        <div className={cn('flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8', className)}>
            <div className="rounded-full bg-destructive/10 p-5">
                <ShieldX className="w-14 h-14 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">{t('auth.accessDenied')}</h2>
            <p className="text-muted-foreground max-w-md leading-relaxed">
                {t('auth.accessDeniedMessage')}
            </p>
        </div>
    );
}
