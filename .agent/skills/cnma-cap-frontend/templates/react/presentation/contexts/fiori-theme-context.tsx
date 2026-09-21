import React, { createContext, useContext, useEffect, useState } from 'react';
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
    setLanguage: () => {},
    setTheme: () => {},
});

export const useFioriTheme = () => useContext(FioriThemeContext);

export function FioriThemeProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState('en');
    const [theme, setThemeState] = useState('');

    // Apply SAP theme to DOM when theme changes
    useEffect(() => {
        if (theme) {
            console.log('[FioriTheme] Applying SAP theme:', theme);
            document.documentElement.setAttribute('data-sap-theme', theme);
            document.body.className = document.body.className.replace(/sapUiTheme-\S+/g, '');
            document.body.classList.add(`sapUiTheme-${theme}`);
        }
    }, [theme]);

    // Read FLP params on mount
    useEffect(() => {
        const { locale, language: langParam, theme: themeParam } = getInitialFLPParams();
        console.log('[FioriTheme] URL params - sap-locale:', locale, 'sap-language:', langParam, 'sap-theme:', themeParam);

        const targetLocale = locale || langParam;

        if (targetLocale) {
            const normalizedLocale = normalizeSapLocale(targetLocale);
            if (normalizedLocale) {
                console.log('[FioriTheme] Setting language from FLP:', normalizedLocale);
                setLanguageState(normalizedLocale);
                // If i18n is configured, call: i18n.changeLanguage(normalizedLocale);
            }
        }

        if (themeParam) {
            console.log('[FioriTheme] Setting theme from FLP:', themeParam);
            setThemeState(themeParam);
        }
    }, []);

    const setLanguage = (lang: string) => {
        console.log('[FioriTheme] Changing language to:', lang);
        setLanguageState(lang);
        // If i18n is configured, call: i18n.changeLanguage(lang);
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
