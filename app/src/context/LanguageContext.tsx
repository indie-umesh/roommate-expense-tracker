import React, { createContext, useContext, useState, useEffect } from "react";
import {
  type LanguageCode,
  AVAILABLE_LANGUAGES,
  TRANSLATIONS,
  type LanguageOption,
} from "../lib/i18n";

interface LanguageContextType {
  lang: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  autoDetect: boolean;
  setAutoDetect: (enabled: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  currentLanguage: LanguageOption;
  availableLanguages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_LANG_KEY = "roommate_app_language";
const STORAGE_AUTO_DETECT_KEY = "roommate_app_auto_detect";

function getSafeStorage(key: string): string | null {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setSafeStorage(key: string, val: string): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, val);
  } catch {}
}

function detectBrowserLanguage(): LanguageCode {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "en";
  try {
    const navLangs = navigator.languages || [navigator.language || ""];
    for (const rawLang of navLangs) {
      const lower = rawLang.toLowerCase();
      if (lower.startsWith("es")) return "es";
      if (lower.startsWith("fr")) return "fr";
      if (lower.startsWith("de")) return "de";
      if (lower.startsWith("ja")) return "ja";
      if (lower.startsWith("zh")) return "zh";
      if (lower.startsWith("pt")) return "pt";
      if (lower.startsWith("ar")) return "ar";
      if (lower.startsWith("ru")) return "ru";
    }
    // Explicit user constraint: "default english rakhna. english k baad hinglish kr dena."
    return "en";
  } catch {
    return "en";
  }
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [autoDetect, setAutoDetectState] = useState<boolean>(() => {
    const saved = getSafeStorage(STORAGE_AUTO_DETECT_KEY);
    return saved === null ? true : saved === "true";
  });

  const [lang, setLangState] = useState<LanguageCode>(() => {
    const saved = getSafeStorage(STORAGE_LANG_KEY) as LanguageCode;
    if (saved && AVAILABLE_LANGUAGES.some((l) => l.code === saved)) {
      return saved;
    }
    return detectBrowserLanguage();
  });

  function setLanguage(code: LanguageCode) {
    setLangState(code);
    setSafeStorage(STORAGE_LANG_KEY, code);
    // When user manually picks a language, don't override on next reload
    setSafeStorage(STORAGE_AUTO_DETECT_KEY, "false");
    setAutoDetectState(false);
  }

  function setAutoDetect(enabled: boolean) {
    setAutoDetectState(enabled);
    setSafeStorage(STORAGE_AUTO_DETECT_KEY, String(enabled));
    if (enabled) {
      const detected = detectBrowserLanguage();
      setLangState(detected);
      setSafeStorage(STORAGE_LANG_KEY, detected);
    }
  }

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      if (lang === "ar") {
        document.documentElement.dir = "rtl";
      } else {
        document.documentElement.dir = "ltr";
      }
    }
  }, [lang]);

  // Translation lookup with fallback to English
  function t(key: string, params?: Record<string, string | number>): string {
    const langDict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    let template = langDict[key] || TRANSLATIONS.en[key] || key;

    if (params) {
      for (const [paramKey, paramVal] of Object.entries(params)) {
        template = template.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramVal));
      }
    }
    return template;
  }

  const currentLanguage =
    AVAILABLE_LANGUAGES.find((l) => l.code === lang) || AVAILABLE_LANGUAGES[0];

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLanguage,
        autoDetect,
        setAutoDetect,
        t,
        currentLanguage,
        availableLanguages: AVAILABLE_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
