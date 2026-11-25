// Global environment configuration
export const MARKETING_HOMEPAGE_URL =
  import.meta.env.VITE_MARKETING_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4321"
    : "/");

export function getInviteUrl(inviteCode: string): string {
  if (typeof window === "undefined") return "";
  const origin = window.location.origin;
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${origin}${base}/join/${inviteCode}`;
}
