import React, { createContext, useContext, useEffect, useState } from 'react';
import i18n from '@/i18n';
import { getInitialFLPParams } from '@/hooks/useFLPSync';

interface FioriThemeContextType {
    language: string;
    theme: string;
    setLanguage: (lang: string) => void;
    setTheme: (theme: string) => void;
}

const defaultContext: FioriThemeContextType = {
    language: 'en',
    theme: '',
    setLanguage: () => { },
    setTheme: () => { },
};

export const FioriThemeContext = createContext<FioriThemeContextType>(defaultContext);
export const useFioriTheme = () => useContext(FioriThemeContext);

export function FioriThemeProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState('en');
    const [theme, setThemeState] = useState('');

    // Apply SAP theme to document element whenever theme changes
    useEffect(() => {
        document.documentElement.setAttribute('data-sap-theme', theme);
        document.body.className = document.body.className.replace(/sapUiTheme-\S+/g, '');
        if (theme) {
            document.body.classList.add(`sapUiTheme-${theme}`);
        }
    }, [theme]);

    // Read SAP locale and theme from parent FLP on mount
    useEffect(() => {
        const { locale, theme: themeParam } = getInitialFLPParams();

        if (locale) {
            setLanguageState(locale);
            i18n.changeLanguage(locale);
        }

        if (themeParam) {
            setThemeState(themeParam);
        }
    }, []);

    const setLanguage = (lang: string) => {
        setLanguageState(lang);
        i18n.changeLanguage(lang);
    };

    const setTheme = (thm: string) => {
        setThemeState(thm);
    };

    return (
        <FioriThemeContext.Provider value={{ language, theme, setLanguage, setTheme }}>
            {children}
        </FioriThemeContext.Provider>
    );
}
