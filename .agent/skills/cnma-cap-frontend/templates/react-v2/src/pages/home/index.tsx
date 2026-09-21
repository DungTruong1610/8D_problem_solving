import { useTranslation } from 'react-i18next';
import { Button } from '@cnma/react-ui';
import { LayoutDashboard, Rocket } from 'lucide-react';

/**
 * Home / Landing page.
 * ★ Replace this with your actual home page content.
 */
export function HomePage() {
    const { t } = useTranslation();

    return (
        <div className="p-6 md:p-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <LayoutDashboard className="w-5 h-5 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground">{t('home.title')}</h1>
                </div>
                <p className="text-muted-foreground">{t('home.subtitle')}</p>
            </div>

            {/* Getting started card */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Rocket className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-semibold text-foreground mb-1">{t('home.gettingStarted')}</h2>
                        <p className="text-sm text-muted-foreground">{t('home.gettingStartedDesc')}</p>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-border flex flex-wrap gap-3">
                    <Button variant="default" size="sm">
                        {t('common.create')}
                    </Button>
                    <Button variant="outline" size="sm">
                        {t('common.filter')}
                    </Button>
                </div>
            </div>

            {/* Placeholder content area */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((n) => (
                    <div
                        key={n}
                        className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
                    >
                        <div className="w-8 h-8 rounded-lg bg-muted mb-3" />
                        <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                ))}
            </div>
        </div>
    );
}
