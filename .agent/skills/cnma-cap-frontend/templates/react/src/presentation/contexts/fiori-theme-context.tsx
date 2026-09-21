import React, { createContext, useContext, useEffect, useState } from 'react';
import i18n from '../../core/i18n'; // Adjust import based on i18n location
import { getInitialFLPParams, normalizeSapLocale } from '../hooks/useFLPSync';

interface FioriThemeContextType {
    language: string;
    theme: string;
    setLanguage: (lang: string) => void;
    setTheme: (thm: string) => void;
}

const FioriThemeContext = createContext<FioriThemeContextType>({
    language: 'en',
    theme: '',
    setLanguage: () => { },
    setTheme: () => { },
});

export const useFioriTheme = () => useContext(FioriThemeContext);

export function FioriThemeProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState('en');
    const [theme, setThemeState] = useState('');

    useEffect(() => {
        if (theme) {
            console.log('[FioriTheme] Applying SAP theme:', theme);
            document.documentElement.setAttribute('data-sap-theme', theme);
            document.body.className = document.body.className.replace(/sapUiTheme-\S+/g, '');
            document.body.classList.add(`sapUiTheme-${theme}`);
        }
    }, [theme]);

    useEffect(() => {
        const { locale, language, theme: themeParam } = getInitialFLPParams();
        console.log('[FioriTheme] URL params - sap-locale:', locale, 'sap-language:', language, 'sap-theme:', themeParam);

        const targetLocale = locale || language;

        if (targetLocale) {
            const normalizedLocale = normalizeSapLocale(targetLocale);
            if (normalizedLocale) {
                console.log('[FioriTheme] Setting language from FLP:', normalizedLocale);
                setLanguageState(normalizedLocale);
                i18n.changeLanguage(normalizedLocale);
            }
        } else {
            console.log('[FioriTheme] No FLP locale found, using default:', i18n.language || 'en');
            setLanguageState(i18n.language || 'en');
        }

        if (themeParam) {
            console.log('[FioriTheme] Setting theme from FLP:', themeParam);
            setThemeState(themeParam);
        }
    }, []);

    const setLanguage = (lang: string) => {
        console.log('[FioriTheme] Changing language to:', lang);
        setLanguageState(lang);
        i18n.changeLanguage(lang);
    };

    const setTheme = (thm: string) => {
        console.log('[FioriTheme] Changing theme to:', thm);
        setThemeState(thm);
    };

    const value = {
        language,
        theme,
        setLanguage,
        setTheme,
    };

    return (
        <FioriThemeContext.Provider value={value}>
            {children}
        </FioriThemeContext.Provider>
    );
}
