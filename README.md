# i18n Tool

An enterprise-grade, cross-platform desktop application for managing translation files, featuring native file system access and AI-powered translation assistance using Google Gemini.

## Features

- **Cross-Platform Desktop App**: Built with Electron, works on macOS, Windows, and Linux.
- **AI Translation**: Seamlessly translate UI strings using Google Gemini (`gemini-2.0-flash`).
- **Rich Interface**: Premium dark/light mode design system with inline editing, missing key highlighting, and real-time search.
- **Drag & Drop**: Easily import JSON locale files by dragging them onto the app window.
- **Extensible Plugin System**: Built-in plugins for JSON formatting and Gemini AI, designed for future extensibility.
- **Export Options**: Save formatted JSON directly to disk or export all locales as a consolidated CSV.

## Development Setup

1. **Clone and Install**
   ```bash
   git clone <repo>
   cd i18n-tool
   npm install
   ```

2. **Run Dev Server**
   Start the Vite dev server and Electron app concurrently:
   ```bash
   npm run dev
   ```

3. **Testing**
   Run the Jest test suite:
   ```bash
   npm test
   ```

4. **Build for Production**
   Package the app for distribution:
   ```bash
   npm run build
   ```

## Tech Stack

- **Electron**: Main process, IPC handlers, system tray, native file dialogs.
- **Vite & Vanilla JS**: Fast, framework-less frontend renderer.
- **Vanilla CSS**: Custom design system using CSS variables and HSL colors.
- **Jest**: Unit testing for isolated services.
- **@google/generative-ai**: Gemini AI integration.
- **electron-store**: Local persistence for settings and preferences.
