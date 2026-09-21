import cds from '@sap/cds';

/**
 * i18n text helper - retrieves localized messages.
 */
export class TextHandler {
    private static instance: TextHandler;
    private messages: Record<string, string> = {};

    private constructor() {}

    static getInstance(): TextHandler {
        if (!TextHandler.instance) {
            TextHandler.instance = new TextHandler();
        }
        return TextHandler.instance;
    }

    /**
     * Get localized text by key.
     * @param key - Message key
     * @param params - Optional replacements {0}, {1}, etc.
     */
    getText(key: string, params?: string[]): string {
        let text = this.messages[key] || key;

        if (params && params.length > 0) {
            params.forEach((param, index) => {
                text = text.replace(new RegExp(`\\{${index}\\}`, 'g'), param);
            });
        }

        return text;
    }

    /**
     * Load messages from CDS i18n.
     */
    loadFromCDS(lang: string = 'en'): void {
        try {
            const i18n = cds.env.i18n?.[lang] || {};
            this.messages = { ...this.messages, ...i18n };
        } catch (error) {
            cds.log.warn('[TextHandler] Failed to load i18n:', error);
        }
    }

    /**
     * Set messages directly (for testing).
     */
    setMessages(messages: Record<string, string>): void {
        this.messages = { ...this.messages, ...messages };
    }
}

export const textHandler = TextHandler.getInstance();
export const getText = (key: string, params?: string[]) => textHandler.getText(key, params);