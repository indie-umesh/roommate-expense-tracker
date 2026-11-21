import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || "https://jwmbpehhosqhcrgvyfeb.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bWJwZWhob3NxaGNyZ3Z5ZmViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyNzMwODksImV4cCI6MjExMDg0OTA4OX0.R-IOdAapIQmW4Lyak1B8UPDMpRGLsSQo0R_Pd39VDfA";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
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
