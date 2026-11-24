/**
 * Global dynamic App URL resolver
 * - Points directly to the built-in PWA web app at /app/ on the same domain
 * - Can be overridden via PUBLIC_APP_URL environment variable if deployed separately
 */
export const APP_URL = import.meta.env.PUBLIC_APP_URL || "/app/";
