// Logo Guesser asset URL helpers.
//
// We fetch logos from logo.dev. The publishable key is safe to expose in the
// frontend bundle (it's a `pk_…` token, designed for browser use) but we still
// route it through an env var so workspaces can rotate it without a code edit.
//
// Set VITE_LOGO_DEV_TOKEN in your .env (or your deployment env). When missing,
// requests still return an image — logo.dev rate-limits unauthenticated calls,
// which is fine for local dev.

const LOGO_DEV_TOKEN = import.meta.env.VITE_LOGO_DEV_TOKEN as string | undefined;

export function logoUrl(domain: string, size: number = 256): string {
  const params = new URLSearchParams({ size: String(size) });
  if (LOGO_DEV_TOKEN) params.set('token', LOGO_DEV_TOKEN);
  return `https://img.logo.dev/${encodeURIComponent(domain)}?${params.toString()}`;
}
