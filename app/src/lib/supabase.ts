import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://jwmbpehhosqhcrgvyfeb.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseAnonKey) {
  console.warn(
    "VITE_SUPABASE_ANON_KEY is not set. Please set it in app/.env for Supabase API requests."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: "roommate-expense-tracker-auth-v1",
  },
});

/**
 * Normalizes a 10-digit Indian phone number to E.164 (+91XXXXXXXXXX)
 */
export function normalizeIndianPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }
  if (digits.length > 10) {
    if (digits.startsWith("0") && digits.length === 11) {
      return `+91${digits.slice(1)}`;
    }
  }
  return input.startsWith("+") ? input : `+91${digits}`;
}

/**
 * Synthetic email fallback for Supabase Auth without SMS/OTP.
 * Maps phone number to a valid synthetic email format: phone9876543210@roommate.com
 */
export function phoneToSyntheticEmail(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  return `phone${digits}@roommate.com`;
}
