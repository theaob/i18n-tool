import { store } from '../store.js';

export const aiService = {
  /**
   * Translates a single string via Gemini (through Electron IPC).
   */
  async translate(text, sourceLang, targetLang) {
    const apiKey = store.get('geminiApiKey');
    if (!apiKey) throw new Error('Gemini API key not configured. Go to Settings.');
    return window.electronAPI.translate({ text, sourceLang, targetLang, apiKey });
  },
};
