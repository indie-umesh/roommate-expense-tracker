import React from "react";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import {
  X,
  Globe,
  Check,
  Sun,
  Moon,
  LogOut,
  Sparkles,
  Smartphone,
  ShieldCheck,
} from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { lang, setLanguage, autoDetect, setAutoDetect, availableLanguages, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { profile, signOut } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#111827] text-[var(--text-primary)] max-w-lg w-full max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-slate-50/70 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[var(--text-primary)] leading-tight">
                {t("settings")}
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {t("language")} • {t("appearance")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* Section 1: Language Switcher */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  <span>{t("language")}</span>
                </h4>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  {t("choose_language")}
                </p>
              </div>

              {/* Auto-detect Toggle */}
              <button
                type="button"
                onClick={() => setAutoDetect(!autoDetect)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 border ${
                  autoDetect
                    ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/40"
                    : "bg-slate-100 dark:bg-white/5 text-[var(--text-muted)] border-slate-200 dark:border-white/10"
                }`}
                title={t("auto_detect_desc")}
              >
                <Sparkles className="w-3 h-3" />
                <span>Auto-detect</span>
              </button>
            </div>

            {/* Language Selection Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {availableLanguages.map((l) => {
                const isSelected = lang === l.code;
                return (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setLanguage(l.code)}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40 shadow-xs"
                        : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-slate-50/50 dark:bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl shrink-0">{l.flag}</span>
                      <div className="truncate">
                        <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1">
                          <span>{l.nativeName}</span>
                          {l.code === "en" && (
                            <span className="text-[9px] bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 px-1.5 py-0.2 rounded font-semibold">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] truncate">
                          {l.name} • {l.region}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Appearance & Theme */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-white/10">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <span>{t("appearance")}</span>
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => theme !== "light" && toggleTheme()}
                className={`p-3 rounded-xl border flex items-center gap-2.5 transition cursor-pointer ${
                  theme === "light"
                    ? "border-indigo-600 bg-indigo-50/80 text-indigo-700 shadow-xs font-bold"
                    : "border-slate-200 hover:border-slate-300 text-[var(--text-muted)]"
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span className="text-xs">{t("theme_light")}</span>
              </button>
              <button
                type="button"
                onClick={() => theme !== "dark" && toggleTheme()}
                className={`p-3 rounded-xl border flex items-center gap-2.5 transition cursor-pointer ${
                  theme === "dark"
                    ? "border-indigo-500 bg-indigo-950/40 text-indigo-300 shadow-xs font-bold"
                    : "border-slate-200 dark:border-white/10 hover:border-white/20 text-[var(--text-muted)]"
                }`}
              >
                <Moon className="w-4 h-4 text-indigo-400" />
                <span className="text-xs">{t("theme_dark")}</span>
              </button>
            </div>
          </div>

          {/* Section 3: Profile & Security */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-white/10">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t("signed_in_as")}</span>
            </h4>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[var(--text-primary)]">
                  {profile?.display_name || "Roommate User"}
                </p>
                {profile?.phone && (
                  <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                    <Smartphone className="w-3 h-3 text-slate-400" />
                    <span>+91 {profile.phone}</span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => signOut()}
                className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t("sign_out")}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50/80 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer shadow-sm active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
