import { z } from 'zod';

export const FourPartVersion = z.string().regex(/^\d+\.\d+\.\d+\.\d+$/);

export const GamePluginManifest = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1).max(80),
  emoji: z.string().min(1).max(16),
  description: z.string().min(1).max(240),
  version: FourPartVersion,
  minPlayers: z.number().int().min(1).max(100),
  maxPlayers: z.number().int().min(1).max(100),
  capabilities: z.object({
    bots: z.boolean(),
    audience: z.boolean(),
    hints: z.boolean(),
    restore: z.boolean(),
  }),
  entrypoints: z.object({
    server: z.string().min(1),
    display: z.string().min(1),
    controller: z.string().min(1),
    companion: z.string().min(1),
  }),
});

export const CatalogGameArtifact = z.object({
  url: z.string().url(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  signature: z.string().min(1),
  size: z.number().int().positive().max(25_000_000),
});

export const OfficialGameCatalog = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  repository: z.literal('https://github.com/thathman/BoredRoom-Games'),
  games: z.array(GamePluginManifest.extend({ artifact: CatalogGameArtifact })).max(100),
});

export type GamePluginManifest = z.infer<typeof GamePluginManifest>;
export type OfficialCatalogGame = z.infer<typeof OfficialGameCatalog>['games'][number];
