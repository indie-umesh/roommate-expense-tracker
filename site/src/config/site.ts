/**
 * Global dynamic App URL resolver
 * - In local development: defaults to Vite dev server (http://localhost:5173)
 * - In production: reads from PUBLIC_APP_URL environment variable, or defaults to the app subdomain
 */
export const APP_URL =
  import.meta.env.PUBLIC_APP_URL ||
  (import.meta.env.DEV ? "http://localhost:5173" : "https://roommate-expense-app.pages.dev");
