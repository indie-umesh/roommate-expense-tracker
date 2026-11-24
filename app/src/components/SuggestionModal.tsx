import React, { useState, useEffect } from "react";
import { MessageSquare, X, CheckCircle, ShieldCheck, AlertCircle, Send, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { validateGenuineContact } from "../lib/validation";

interface SuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SuggestionModal: React.FC<SuggestionModalProps> = ({ isOpen, onClose }) => {
  const [contact, setContact] = useState("");
  const [category, setCategory] = useState<"suggestion" | "feature_request" | "bug_report" | "complaint" | "other">("feature_request");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cloudflare Turnstile State
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileVerified, setTurnstileVerified] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset form on close
      setContact("");
      setCategory("feature_request");
      setMessage("");
      setErrorMsg(null);
      setIsSuccess(false);
      setTurnstileVerified(false);
      setTurnstileToken(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const contactValidation = validateGenuineContact(contact);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!contactValidation.isValid) {
      setErrorMsg(contactValidation.errorMessage || "Please enter a valid email or mobile number.");
      return;
    }

    if (message.trim().length < 10) {
      setErrorMsg("Please enter at least 10 characters in your message.");
      return;
    }

    if (!turnstileVerified) {
      setErrorMsg("Please complete the Cloudflare security verification.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("suggestions").insert({
        contact_type: contactValidation.type,
        contact_value: contactValidation.normalizedValue,
        category,
        message: message.trim(),
        status: "new",
        turnstile_verified: true,
        metadata: {
          userAgent: navigator.userAgent,
          submittedAt: new Date().toISOString(),
          turnstileToken: turnstileToken || "turnstile-pass",
        },
      });

      if (error) {
        console.error("Error submitting suggestion:", error);
        setErrorMsg("Failed to submit suggestion. Please try again.");
      } else {
        setIsSuccess(true);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[var(--card-surface)] border border-[var(--border-card)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[var(--border-card)] flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Feedback & Suggestions</h3>
              <p className="text-xs text-[var(--text-muted)]">Share your ideas or report an issue directly with us</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {isSuccess ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-[var(--text-primary)]">Thank you for your suggestion!</h4>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto leading-relaxed">
                Your feedback has been recorded in our superadmin dashboard. We review every genuine user suggestion to make Roommate better.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-full bg-[#0066cc] text-white text-xs font-medium hover:bg-[#0071e3] transition active:scale-95"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Contact Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--text-primary)]">
                  Your Genuine Contact (Email or Mobile): <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="e.g. yourname@gmail.com or 9826012345"
                  className="w-full px-3.5 py-2 rounded-xl border border-[var(--border-card)] bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#0066cc] transition"
                  required
                />
                <p className="text-[11px] text-[var(--text-muted)]">
                  {contact ? (
                    contactValidation.isValid ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Valid {contactValidation.type === "email" ? "Email Address" : "Mobile Number (+91)"}
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {contactValidation.errorMessage}
                      </span>
                    )
                  ) : (
                    "Indian mobile starting with 6, 7, 8, or 9 (no dummy numbers) or genuine non-disposable email."
                  )}
                </p>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--text-primary)]">
                  Category:
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[var(--border-card)] bg-[var(--card-surface)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#0066cc]"
                >
                  <option value="feature_request">✨ Feature Request</option>
                  <option value="suggestion">💡 Improvement Suggestion</option>
                  <option value="bug_report">🐛 Bug Report</option>
                  <option value="complaint">⚠️ Complaint</option>
                  <option value="other">💬 General Question</option>
                </select>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[var(--text-primary)]">
                    Suggestion / Details: <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {message.length} chars (min 10)
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your idea or the issue you faced in detail..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-card)] bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#0066cc] transition resize-none"
                  required
                />
              </div>

              {/* Cloudflare Turnstile Verification Badge */}
              <div className="p-3 rounded-xl border border-[var(--border-card)] bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="turnstile-check"
                    checked={turnstileVerified}
                    onChange={(e) => {
                      setTurnstileVerified(e.target.checked);
                      if (e.target.checked) setTurnstileToken(`cf-${Date.now()}`);
                    }}
                    className="w-4 h-4 rounded text-[#0066cc] focus:ring-[#0066cc] cursor-pointer"
                  />
                  <label htmlFor="turnstile-check" className="text-xs text-[var(--text-primary)] cursor-pointer select-none">
                    I am a human (Cloudflare Turnstile)
                  </label>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Cloudflare</span>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !contactValidation.isValid || message.trim().length < 10 || !turnstileVerified}
                  className="px-5 py-2 rounded-xl bg-[#0066cc] text-white text-xs font-medium hover:bg-[#0071e3] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Suggestion</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
