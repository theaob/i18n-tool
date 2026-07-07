# i18n Tool - Future Work

## 🎯 Major Features

### 1. **Plugin System Enhancements**
- **More Translation Providers**: Official plugins for DeepL, Google Translate API, and OpenAI.
- **Workflow Rules**: Conditional translation rules based on project type.

### 2. **Git Integration (Dev Workflow)**
- **Git Backend**: Native support for reading/writing git repos directly.
- **Auto-Commit & PR**: Automatically commit translation changes and open Pull Requests on GitHub/GitLab/Azure DevOps.
- **Branch Management**: Visual branch switcher and merge tools.
- **Offline Mode**: Enhanced offline support for local git repos.

---

## ⚡ Speed & Performance

- **Lazy Loading**: Load plugins and large datasets on demand.
- **Memory Optimization**: Smart caching strategies for massive JSON/TS files.
- **Parallel Processing**: Use Web Workers for heavy tasks like CSV parsing and diff calculations.

---

## 🛠️ Technical Debt & Refactoring

- **Modularize Backend**: Decouple services (Google Translate, DeepL) into swappable modules.
- **Type Safety**: Migrate the frontend to full TypeScript to reduce runtime errors.
- **E2E Testing**: Add comprehensive E2E tests (Playwright) to complement existing Jest unit tests.

---

## 💰 Business & Enterprise

- **Subscription System**: Manage paid access for premium features (e.g., DeepL API usage limits).
- **Team Management**: Roles (Owner, Editor, Reviewer) and permissions.
- **Audit Logs**: Track who changed what and when, especially for critical translation keys.

---

## ✅ Recently Completed

- ~~**Plugin System (The "App Store")**~~: Added `plugins.js` system for dynamic plugin loading.
- ~~**AI Translation Assistant**~~: Native integration with Gemini AI to translate strings.
- ~~**Formatters**~~: Added robust support for parsing and merging TypeScript (`.ts`) locale files.
- ~~**Desktop Application**~~: Transitioned to a native desktop app via Electron.
- ~~**OS Features**~~: Added native file system access and dialogs.
- ~~**Dark Mode**~~: Added light/dark/system themes.
- ~~**Keyboard Shortcuts**~~: Added comprehensive shortcuts for power users.
- ~~**Drag & Drop**~~: Support for dragging JSON/TS files directly onto the app.
- ~~**Inline Previews**~~: Real-time HTML previews for translation strings.
- ~~**Unit Testing**~~: Fully integrated Jest with a comprehensive suite of unit tests.