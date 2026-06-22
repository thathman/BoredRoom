// ============================================================
// BoredRoom — Phase 2 prep: Pack & Theme Types
// Source of truth: BoredRoom-Spec/06-data-models/03-pack-schema.md
// ============================================================

export type AgeRating = "kids" | "family" | "teen" | "adult";

export interface PackManifest {
  id: string;
  name: string;
  version: string;
  category: string;
  ageRating: AgeRating;
  description: string;
  games: string[];
  contentPacks: string[];
  themes: string[];
  hostPersonalities: string[];
  requiresModeration: boolean;
  supportsAudience: boolean;
  supportsVoice: boolean;
  offlineReady: boolean;
}

export interface ThemeManifest {
  id: string;
  packId: string;
  name: string;
  tokens: Record<string, string>;
}
