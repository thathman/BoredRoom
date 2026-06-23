// Pack system contracts (Phase 2).
//
// Packs own content, themes, game lists, and safety metadata (constitution Art. I.7).
// Theme differences are expressed as design-token references, not bespoke CSS (Art. I.8);
// the token values themselves land in Phase 7 — here a PackTheme only names the token set.
// Canonical: BoredRoom-Spec/06-data-models/03-pack-schema.md.

import { z } from 'zod';
import { AgeRating } from './session.js';

const Id = z.string().min(1);

// A theme is a named pointer to a design-token set (resolved in Phase 7).
export const PackTheme = z.object({
  id: Id,
  name: z.string().min(1),
  tokenSet: z.string().min(1), // e.g. "naija", "faith", "market" — keyed into the token registry
  preview: z.string().optional(), // optional asset url/path for pack pickers
});

export const PackManifest = z.object({
  id: Id,
  name: z.string().min(1),
  version: z.string().min(1),
  category: z.string().min(1),
  ageRating: AgeRating,
  description: z.string().default(''),
  games: z.array(z.string()).min(1), // game slugs from the GameAdapter registry
  contentPacks: z.array(Id).default([]),
  themes: z.array(Id).default([]), // PackTheme ids this pack ships
  defaultThemeId: Id.optional(),
  hostPersonalities: z.array(z.string()).default([]),
  requiresModeration: z.boolean().default(false),
  supportsAudience: z.boolean().default(true),
  supportsVoice: z.boolean().default(false),
  offlineReady: z.boolean().default(false),
});

export type PackTheme = z.infer<typeof PackTheme>;
export type PackManifest = z.infer<typeof PackManifest>;
