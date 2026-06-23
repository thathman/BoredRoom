// Design tokens + theme application (Phase 7).
//
// Themes are expressed purely as design tokens (constitution Art. I.8) over the existing shadcn HSL
// CSS variables, so a pack's theme is data, not bespoke CSS. tokenSet ids match PackTheme.tokenSet
// in src/lib/packs.ts. applyTheme writes the variables onto a target element; ThemeProvider wires it
// to a pack. Values are "H S% L%" triples (shadcn convention) consumed as hsl(var(--x)).
//
// These are sensible starting palettes; refine with the design phase (Style Dictionary can later
// generate this map from a token source — the shape stays the same).

export type TokenSet = 'naija' | 'faith' | 'market';

// The token keys every theme must define (the core palette the UI relies on).
export const REQUIRED_TOKENS = [
  'background',
  'foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'accent',
  'accent-foreground',
  'muted',
  'muted-foreground',
  'card',
  'card-foreground',
  'border',
] as const;

export type TokenKey = (typeof REQUIRED_TOKENS)[number];

export type ThemeTokens = Record<TokenKey, string>;

export const THEME_TOKENS: Record<TokenSet, ThemeTokens> = {
  // Naija Street — neon green energy on deep night (matches the existing default vibe).
  naija: {
    background: '240 15% 6%',
    foreground: '0 0% 98%',
    primary: '160 100% 50%',
    'primary-foreground': '240 15% 6%',
    secondary: '270 60% 55%',
    'secondary-foreground': '0 0% 98%',
    accent: '30 100% 60%',
    'accent-foreground': '240 15% 6%',
    muted: '240 10% 16%',
    'muted-foreground': '0 0% 70%',
    card: '240 14% 9%',
    'card-foreground': '0 0% 98%',
    border: '240 10% 20%',
  },
  // Faith & Family — warm gold + deep indigo, calm and bright.
  faith: {
    background: '240 30% 12%',
    foreground: '45 40% 96%',
    primary: '45 90% 55%',
    'primary-foreground': '240 30% 12%',
    secondary: '255 45% 45%',
    'secondary-foreground': '45 40% 96%',
    accent: '15 80% 60%',
    'accent-foreground': '240 30% 12%',
    muted: '240 20% 22%',
    'muted-foreground': '45 20% 75%',
    card: '240 28% 16%',
    'card-foreground': '45 40% 96%',
    border: '240 20% 26%',
  },
  // Market Day — bright daylight, earthy red + green, high-contrast for kids.
  market: {
    background: '40 30% 96%',
    foreground: '20 20% 12%',
    primary: '8 75% 50%',
    'primary-foreground': '40 30% 96%',
    secondary: '140 50% 38%',
    'secondary-foreground': '40 30% 96%',
    accent: '38 90% 52%',
    'accent-foreground': '20 20% 12%',
    muted: '40 20% 88%',
    'muted-foreground': '20 12% 38%',
    card: '40 35% 99%',
    'card-foreground': '20 20% 12%',
    border: '40 15% 80%',
  },
};

export function isTokenSet(value: string | undefined | null): value is TokenSet {
  return value === 'naija' || value === 'faith' || value === 'market';
}

// Apply a theme by writing its tokens as CSS custom properties on the target element.
export function applyTheme(
  tokenSet: TokenSet,
  target: { style: { setProperty(prop: string, value: string): void } } = document.documentElement,
): void {
  const tokens = THEME_TOKENS[tokenSet];
  for (const key of REQUIRED_TOKENS) {
    target.style.setProperty(`--${key}`, tokens[key]);
  }
}
