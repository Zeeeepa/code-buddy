---
title: "src — i18n"
module: "src-i18n"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.519Z"
---
# src — i18n

The `src/i18n` module provides the internationalization (i18n) system for the application, enabling locale-aware string translation and parameter interpolation. Its primary goal is to ensure all user-facing text can be presented in multiple languages, adapting to the user's environment or explicit settings.

## Purpose

This module centralizes all application strings, allowing them to be translated into various languages. It handles:

*   **Locale Detection:** Automatically determines the user's preferred language based on environment variables.
*   **String Translation:** Provides a simple function to retrieve translated strings by a unique key.
*   **Parameter Interpolation:** Supports dynamic values within translated strings (e.g., "Executing {tool}..." where `{tool}` is replaced at runtime).
*   **Fallback Mechanism:** Ensures that if a translation is missing for a specific locale, it gracefully falls back to English.

## Core Concepts

### Supported Locales

The system supports the following 6 locales, defined by the `Locale` type:

*   `en` (English) - The reference locale, always complete.
*   `fr` (French) - Currently complete.
*   `de` (German) - Stubbed, falls back to English for all keys.
*   `es` (Spanish) - Stubbed, falls back to English for all keys.
*   `ja` (Japanese) - Stubbed, falls back to English for all keys.
*   `zh` (Chinese) - Stubbed, falls back to English for all keys.

### Translation Keys (`I18nStrings`)

All translatable strings are identified by a unique key, defined in the `I18nStrings` interface. These keys are structured hierarchically (e.g., `common.yes`, `cli.welcome`, `errors.api_error`) to categorize strings logically.

```typescript
export interface I18nStrings {
  'common.yes': string;
  'cli.welcome': string;
  'errors.api_error': string;
  // ... other keys
}
```

### Locale Tables

The `localeTables` object (`Record<Locale, I18nStrings>`) stores the complete set of translated strings for each supported locale.

*   `localeTables.en` and `localeTables.fr` are populated with their respective full translations.
*   For stubbed locales (`de`, `es`, `ja`, `zh`), their entries in `localeTables` are initialized as copies of the `en` table. This ensures that even for untranslated locales, every key will resolve to an English string, preventing runtime errors for missing translations.

## How It Works

### Locale Detection

The system attempts to determine the user's preferred locale automatically on its first use (either via `t()` or `getLocale()`). The `autoDetectLocale()` function follows this priority:

1.  `process.env.CODEBUDDY_LOCALE`
2.  `process.env.LANG`
3.  `process.env.LC_ALL`
4.  Defaults to `'en'` if no environment variable is set or if the detected locale is not supported.

The detected locale code (e.g., `en` from `en_US.UTF-8`) is then checked against the list of `supported` locales. Once detected, the `autoDetected` flag is set to `true` to prevent re-detection unless explicitly reset.

### Translation Process (`t` function)

The core of the i18n system is the `t` function. When called, it performs the following steps:

1.  **Auto-detection Check:** If `autoDetected` is `false`, it calls `autoDetectLocale()` to set `currentLocale`.
2.  **String Retrieval:** It attempts to find the string for the given `key` in the `localeTables[currentLocale]`.
3.  **Fallback:** If the string is not found in the `currentLocale` table (which can happen for stubbed locales or if a translation is genuinely missing), it falls back to `localeTables.en`. If the key is still not found (indicating a missing key in the reference English table), it returns the `key` itself as a last resort.
4.  **Parameter Interpolation:** If `params` are provided, it replaces all occurrences of `{paramKey}` in the retrieved string with the corresponding `paramValue`.

The following diagram illustrates the flow of the `t` function:

```mermaid
graph TD
    A[Call t(key, params?)] --> B{autoDetected?};
    B -- No --> C[autoDetectLocale()];
    C --> D[Set currentLocale];
    B -- Yes --> D;
    D --> E[Get string from localeTables[currentLocale]];
    E -- Key not found --> F[Fallback to localeTables.en];
    F -- Key not found --> G[Return key itself];
    E -- Key found --> H[Interpolate params];
    F -- Key found --> H;
    H --> I[Return translated string];
```

### Parameter Interpolation

Translated strings can include placeholders using the `{name}` syntax. The `t` function replaces these placeholders with values provided in the `params` object.

**Example:**

```typescript
// In en.ts:
// 'tools.executing': 'Executing {tool}...'

t('tools.executing', { tool: 'CodeLinter' });
// => "Executing CodeLinter..."
```

## API Reference

### `t(key: keyof I18nStrings, params?: Record<string, string>): string`

The primary function for retrieving translated strings.

*   `key`: The unique identifier for the string (must be a key defined in `I18nStrings`).
*   `params`: An optional object where keys match the placeholders in the translated string (e.g., `{ tool: 'MyTool' }`).

**Returns:** The translated and interpolated string.

### `setLocale(locale: Locale): void`

Explicitly sets the active locale for the application. This overrides any auto-detected locale and prevents future auto-detection until `resetI18n()` is called.

*   `locale`: The `Locale` code to set (e.g., `'fr'`, `'en'`).

### `getLocale(): Locale`

Retrieves the currently active locale. If the locale has not yet been auto-detected or explicitly set, this function will trigger `autoDetectLocale()`.

**Returns:** The current `Locale`.

### `isLocaleSupported(locale: string): locale is Locale`

Checks if a given string corresponds to one of the supported `Locale` codes.

*   `locale`: The string to check.

**Returns:** `true` if the locale is supported, `false` otherwise.

### `getSupportedLocales(): Locale[]`

Returns an array of all `Locale` codes currently supported by the system.

**Returns:** An array of `Locale` strings.

### `resetI18n(): void`

Resets the i18n system's internal state. This sets `currentLocale` back to `'en'` and `autoDetected` to `false`, allowing auto-detection to run again on the next call to `t()` or `getLocale()`. This function is primarily intended for testing purposes.

## Integration and Usage

To use the i18n system, simply import the `t` function from `src/i18n/index.ts` and call it with the desired key and any parameters.

```typescript
import { t, setLocale, getLocale } from './i18n';

// Example usage in a CLI command
export function greetUser() {
  console.log(t('cli.welcome')); // "Welcome to Code Buddy!" (or French, etc.)
  console.log(t('cli.help'));
}

// Example of dynamic error message
try {
  // ... some API call
} catch (error: any) {
  console.error(t('errors.api_error', { message: error.message }));
}

// Changing locale dynamically
setLocale('fr');
console.log(t('cli.welcome')); // "Bienvenue dans Code Buddy !"

// Getting current locale
console.log(`Current locale: ${getLocale()}`);
```

The `t` function is designed to be called anywhere a translated string is needed. The initial locale will be determined automatically based on environment variables, but can be overridden programmatically using `setLocale()`.

## Contributing to Translations

To add new translations or update existing ones:

1.  **Update `I18nStrings`:** If new keys are needed, add them to the `I18nStrings` interface in `src/i18n/index.ts`.
2.  **Add/Update Locale Table:**
    *   For `en` and `fr`, directly modify the `en` or `fr` constant objects.
    *   For `de`, `es`, `ja`, `zh`, these are currently stubbed. To provide full translations for one of these, you would:
        1.  Create a new `const <localeCode>: I18nStrings = { ... }` object.
        2.  Populate it with all keys from `I18nStrings`.
        3.  Remove the locale code from the `stubLocales` array.
        4.  Register it explicitly in `localeTables` (e.g., `localeTables.de = de;`).
3.  **Ensure Completeness:** The `en` locale must always be complete. For other locales, if a key is missing, it will fall back to the English translation.
4.  **Testing:** Run unit tests (`i18n.test.ts`) to ensure translations and locale switching work as expected.