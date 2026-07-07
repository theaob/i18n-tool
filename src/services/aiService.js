import { store } from '../store.js';

export const aiService = {
  /**
   * Translates a single string via Gemini (through Electron IPC).
   */
  async translate(text, sourceLang, targetLang) {
    const apiKey = store.get('geminiApiKey');
    const model = store.get('geminiModel') || 'gemini-2.0-flash';
    if (!apiKey) throw new Error('Gemini API key not configured. Go to Settings.');
    return window.electronAPI.translate({ text, sourceLang, targetLang, apiKey, model });
  },
};
