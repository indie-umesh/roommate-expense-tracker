// Global environment configuration
export const MARKETING_HOMEPAGE_URL =
  import.meta.env.VITE_MARKETING_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4321"
    : "/");
