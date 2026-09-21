import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import i18n from '@/i18n';
import { getInitialFLPParams } from '@/hooks/use-flpsync';
import { identityService } from '@/services/identity-http-client';

export const DEFAULT_THEME = 'proconarumv2@';

const THEME_ID_MAP: Record<string, string> = {
    '4053e695-cfdc-4cf4-8224-c32bfba47816': 'proconarumv2@',
    '6e8bb4e4-4176-484a-9823-40c77415c455': 'sap_horizon',
    'd29ddfb3-80d3-4092-8374-713db1332805': 'sap_fiori_3_dark',
};

interface FioriThemeContextType {
    language: string;
    theme: string;
    setLanguage: (lang: string) => void;
    setTheme: (theme: string) => void;
}

const defaultContext: FioriThemeContextType = {
    language: 'en',
    theme: DEFAULT_THEME,
    setLanguage: () => { },
    setTheme: () => { },
};

export const FioriThemeContext = createContext<FioriThemeContextType>(defaultContext);
export const useFioriTheme = () => useContext(FioriThemeContext);

export function FioriThemeProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState('en');
    const [theme, setThemeState] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('cnma-theme') || DEFAULT_THEME;
        }
        return DEFAULT_THEME;
    });
    const savedThemeRef = useRef<string>(theme);

    // Apply SAP theme to document element whenever theme changes
    useEffect(() => {
        const activeTheme = theme || DEFAULT_THEME;
        document.documentElement.setAttribute('data-sap-theme', activeTheme);
        document.body.className = document.body.className.replace(/sapUiTheme-\S+/g, '');
        document.body.classList.add(`sapUiTheme-${activeTheme}`);

        if (activeTheme === 'sap_fiori_3_dark' || activeTheme === 'sap-dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        try {
            localStorage.setItem('cnma-theme', activeTheme);
        } catch {
            // ignore storage errors
        }
    }, [theme]);

    // Read SAP locale and theme on initial mount
    useEffect(() => {
        const isStandalone = typeof window !== 'undefined' && window.parent === window;
        const { locale, theme: themeParam } = getInitialFLPParams();

        if (locale) {
            setLanguageState(locale);
            i18n.changeLanguage(locale);
        }

        if (themeParam) {
            setThemeState(themeParam);
            savedThemeRef.current = themeParam;
        }

        // Standalone mode: fetch user's saved preferences from backend
        if (isStandalone && !themeParam && !locale) {
            identityService.getUserSettingsExpanded()
                .then((rows) => {
                    const settings = rows?.[0];
                    if (!settings) return;

                    const langCode = settings.language?.code;
                    if (langCode) {
                        setLanguageState(langCode);
                        i18n.changeLanguage(langCode);
                    }

                    const themeCode = settings.theme?.code;
                    if (themeCode) {
                        setThemeState(themeCode);
                        savedThemeRef.current = themeCode;
                    }
                })
                .catch((err) => {
                    console.warn('[FioriThemeContext] Could not load user settings for theme/language:', err);
                });
        }
    }, []);

    // Listen for settings-changed events dispatched by UserPreferencesDialog
    useEffect(() => {
        const handleSettingsChanged = async (event: Event) => {
            const customEvent = event as CustomEvent<{ theme_ID?: string; language_ID?: string }>;
            const themeId = customEvent.detail?.theme_ID;

            // Fast path: map theme_ID directly if known
            if (themeId && THEME_ID_MAP[themeId]) {
                const mappedTheme = THEME_ID_MAP[themeId];
                setThemeState(mappedTheme);
                savedThemeRef.current = mappedTheme;
            }

            try {
                // Fetch fresh expanded settings from backend
                const rows = await identityService.getUserSettingsExpanded();
                const settings = rows?.[0];
                if (!settings) return;

                const langCode = settings.language?.code;
                if (langCode) {
                    setLanguageState(langCode);
                    i18n.changeLanguage(langCode);
                }

                const themeCode = settings.theme?.code;
                if (themeCode) {
                    setThemeState(themeCode);
                    savedThemeRef.current = themeCode;
                }
            } catch (err) {
                console.warn('[FioriThemeContext] Failed to apply settings after save:', err);
            }
        };

        window.addEventListener('cap-identity:settings-changed', handleSettingsChanged);
        return () => {
            window.removeEventListener('cap-identity:settings-changed', handleSettingsChanged);
        };
    }, []);

    // Live preview when clicking theme chips in User Preferences Dialog
    useEffect(() => {
        const handleDocumentClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;

            // Check if clicking inside UserPreferences dialog theme chips or select options
            const button = target.closest('button, [role="option"]') as HTMLElement | null;
            if (!button) return;

            const text = (button.textContent || '').trim();
            if (text.includes('Proconarum Theme')) {
                setThemeState('proconarumv2@');
            } else if (text.includes('Sap default')) {
                setThemeState('sap_horizon');
            } else if (text.includes('SAP Dark')) {
                setThemeState('sap_fiori_3_dark');
            } else if (button.textContent?.trim() === 'Cancel') {
                // Revert to saved theme on cancel
                setThemeState(savedThemeRef.current);
            }
        };

        document.addEventListener('click', handleDocumentClick, true);
        return () => {
            document.removeEventListener('click', handleDocumentClick, true);
        };
    }, []);

    const setLanguage = (lang: string) => {
        setLanguageState(lang);
        i18n.changeLanguage(lang);
    };

    const setTheme = (thm: string) => {
        setThemeState(thm);
        savedThemeRef.current = thm;
    };

    return (
        <FioriThemeContext.Provider value={{ language, theme, setLanguage, setTheme }}>
            {children}
        </FioriThemeContext.Provider>
    );
}
