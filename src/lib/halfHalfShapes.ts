// Stylized SVG silhouettes for Half & Half objects.
// v1: a small set of hand-tuned generic shapes keyed off `shape`. Each shape
// is rendered into a 0..1 normalized box (x: 0..1 width, y: 0..1 height) so
// the cut-line can map 1:1 to the slider position.
//
// We deliberately avoid photographic assets — a clean silhouette reads better
// at party-game sizes and never breaks on slow connections.

import type { HalfHalfShape } from '../../shared/src/games/halfhalf/objects';

interface ShapeRender {
  /** SVG path (within the unit box 0..1 → use viewBox 0 0 1000 400 for horiz). */
  path: string;
  /** Aspect ratio (w/h). Horizontal-axis shapes are wide; vertical are tall. */
  aspect: number;
  /** Optional emoji to overlay if path is too abstract. */
  emoji?: string;
}

// Simple parametric shapes drawn in a 1000×400 viewBox (or 400×1000 if vertical).
// Most paths are smoothed superellipses tuned per object.
const RENDERS: Record<HalfHalfShape, ShapeRender> = {
  potato:       { aspect: 1.6, emoji: '🥔', path: blob([0.05, 0.95], [0.45, 0.55], 0.7) },
  baguette:     { aspect: 4.0, emoji: '🥖', path: capsule(0.04) },
  rope:         { aspect: 6.0, emoji: '🪢', path: capsule(0.18) },
  jollofPan:    { aspect: 1.4, emoji: '🍚', path: pan() },
  suyaStick:    { aspect: 6.0, emoji: '🍢', path: skewer() },
  mapNigeria:   { aspect: 1.3, emoji: '🇳🇬', path: blob([0.05, 0.95], [0.10, 0.90], 0.5) },
  danfoBus:     { aspect: 2.0, emoji: '🚐', path: bus() },
  agbadaSleeve: { aspect: 2.5, emoji: '👕', path: sleeve() },
  banana:       { aspect: 3.0, emoji: '🍌', path: bananaPath() },
  cucumber:     { aspect: 4.5, emoji: '🥒', path: capsule(0.10) },
  pencil:       { aspect: 5.0, emoji: '✏️', path: pencilPath() },
  carrot:       { aspect: 3.0, emoji: '🥕', path: tapered(0.45, 0.05) },
  fish:         { aspect: 2.2, emoji: '🐟', path: fishPath() },
  plantain:     { aspect: 3.5, emoji: '🍌', path: bananaPath() },
  palmFrond:    { aspect: 2.5, emoji: '🌴', path: tapered(0.40, 0.10) },
  wineBottle:   { aspect: 3.5, emoji: '🍷', path: bottlePath() },
  guitar:       { aspect: 2.8, emoji: '🎸', path: guitarPath() },
  goat:         { aspect: 1.8, emoji: '🐐', path: blob([0.05, 0.95], [0.30, 0.85], 0.6) },
  sausage:      { aspect: 4.0, emoji: '🌭', path: capsule(0.12) },
  pawpaw:       { aspect: 1.3, emoji: '🥭', path: blob([0.10, 0.90], [0.10, 0.90], 0.55) },
  amalaSwallow: { aspect: 0.9, emoji: '🍲', path: blobV([0.10, 0.90], [0.10, 0.90], 0.55) },
  agege:        { aspect: 2.0, emoji: '🍞', path: capsule(0.20) },
  meatPie:      { aspect: 1.6, emoji: '🥧', path: blob([0.10, 0.90], [0.20, 0.80], 0.5) },
  eggRoll:      { aspect: 2.5, emoji: '🥚', path: capsule(0.10) },
  chinChin:     { aspect: 1.6, emoji: '🍪', path: blob([0.10, 0.90], [0.30, 0.80], 0.45) },
  sugarcane:    { aspect: 6.0, emoji: '🎋', path: capsule(0.06) },
  okra:         { aspect: 3.0, emoji: '🌶️', path: tapered(0.30, 0.10) },
  pepper:       { aspect: 2.0, emoji: '🌶️', path: tapered(0.40, 0.10) },
  snail:        { aspect: 1.5, emoji: '🐌', path: blob([0.05, 0.95], [0.30, 0.85], 0.5) },
  tortoise:     { aspect: 1.6, emoji: '🐢', path: blob([0.05, 0.95], [0.30, 0.85], 0.55) },
  cocaCola:     { aspect: 3.5, emoji: '🥤', path: bottlePath() },
  paintBrush:   { aspect: 5.0, emoji: '🖌️', path: tapered(0.10, 0.30) },
  umbrella:     { aspect: 0.8, emoji: '☂️', path: umbrellaPath() },
  fanMilk:      { aspect: 0.6, emoji: '🥛', path: capsuleV(0.20) },
  kekeNapep:    { aspect: 1.5, emoji: '🛺', path: bus() },
  mapLagos:     { aspect: 1.4, emoji: '🗺️', path: blob([0.05, 0.95], [0.20, 0.80], 0.5) },
  mapAfrica:    { aspect: 0.85, emoji: '🌍', path: blobV([0.10, 0.90], [0.05, 0.95], 0.5) },
  mortar:       { aspect: 0.7, emoji: '🥣', path: mortarPath() },
  broom:        { aspect: 4.0, emoji: '🧹', path: tapered(0.05, 0.30) },
  gele:         { aspect: 2.5, emoji: '🎀', path: blob([0.05, 0.95], [0.20, 0.80], 0.55) },
};

export function getShapeRender(shape: string): ShapeRender {
  return RENDERS[shape as HalfHalfShape] ?? RENDERS.baguette;
}

// ── path generators (all tuned for the 1000×400 horizontal viewBox unless
// the name ends with V, in which case 400×1000) ──────────────────────────

function capsule(insetTop: number): string {
  // Horizontal capsule (cylinder lying on its side).
  const t = insetTop * 400;
  const b = 400 - t;
  return `M 40,${t} L 960,${t} A ${(b - t) / 2} ${(b - t) / 2} 0 0 1 960,${b} L 40,${b} A ${(b - t) / 2} ${(b - t) / 2} 0 0 1 40,${t} Z`;
}
function capsuleV(insetSide: number): string {
  const s = insetSide * 400;
  const e = 400 - s;
  return `M ${s},40 L ${e},40 A ${(e - s) / 2} ${(e - s) / 2} 0 0 1 ${e},960 L ${s},960 A ${(e - s) / 2} ${(e - s) / 2} 0 0 1 ${s},40 Z`;
}

function tapered(headWidth: number, tailWidth: number): string {
  // Trapezoidal "carrot" with rounded ends.
  const hT = (1 - headWidth) / 2 * 400;
  const hB = 400 - hT;
  const tT = (1 - tailWidth) / 2 * 400;
  const tB = 400 - tT;
  return `M 40,${hT} L 960,${tT} L 960,${tB} L 40,${hB} Z`;
}

function blob(xRange: [number, number], yRange: [number, number], roundness: number): string {
  // Smoothed quadrilateral via cubic Bezier.
  const [x0, x1] = xRange;
  const [y0, y1] = yRange;
  const X0 = x0 * 1000, X1 = x1 * 1000;
  const Y0 = y0 * 400, Y1 = y1 * 400;
  const r = Math.max(20, roundness * 100);
  return `M ${X0 + r},${Y0} L ${X1 - r},${Y0} Q ${X1},${Y0} ${X1},${Y0 + r} L ${X1},${Y1 - r} Q ${X1},${Y1} ${X1 - r},${Y1} L ${X0 + r},${Y1} Q ${X0},${Y1} ${X0},${Y1 - r} L ${X0},${Y0 + r} Q ${X0},${Y0} ${X0 + r},${Y0} Z`;
}

function blobV(xRange: [number, number], yRange: [number, number], roundness: number): string {
  // Same but for vertical viewBox (400×1000)
  const [x0, x1] = xRange;
  const [y0, y1] = yRange;
  const X0 = x0 * 400, X1 = x1 * 400;
  const Y0 = y0 * 1000, Y1 = y1 * 1000;
  const r = Math.max(20, roundness * 80);
  return `M ${X0 + r},${Y0} L ${X1 - r},${Y0} Q ${X1},${Y0} ${X1},${Y0 + r} L ${X1},${Y1 - r} Q ${X1},${Y1} ${X1 - r},${Y1} L ${X0 + r},${Y1} Q ${X0},${Y1} ${X0},${Y1 - r} L ${X0},${Y0 + r} Q ${X0},${Y0} ${X0 + r},${Y0} Z`;
}

function pan(): string {
  // Round bowl + handle on right.
  return 'M 80,80 C 80,40 920,40 920,80 L 880,320 C 880,360 120,360 120,320 Z M 920,160 L 980,200 L 920,240 Z';
}

function skewer(): string {
  // Stick with three meat squares.
  return 'M 20,190 L 980,190 L 980,210 L 20,210 Z M 250,140 L 350,140 L 350,260 L 250,260 Z M 470,140 L 570,140 L 570,260 L 470,260 Z M 690,140 L 790,140 L 790,260 L 690,260 Z';
}

function bus(): string {
  return 'M 60,140 L 880,140 L 940,200 L 940,300 L 60,300 Z M 200,300 A 40 40 0 0 0 280 300 M 700,300 A 40 40 0 0 0 780 300';
}

function sleeve(): string {
  return 'M 40,140 L 700,80 L 960,160 L 960,260 L 700,330 L 40,280 Z';
}

function bananaPath(): string {
  return 'M 40,260 Q 500,40 960,180 Q 960,220 920,240 Q 500,120 80,300 Q 40,290 40,260 Z';
}

function pencilPath(): string {
  return 'M 40,160 L 800,160 L 960,200 L 800,240 L 40,240 Z M 760,170 L 800,170 L 800,230 L 760,230 Z';
}

function fishPath(): string {
  return 'M 60,200 Q 200,80 600,80 Q 800,80 880,200 Q 800,320 600,320 Q 200,320 60,200 Z M 880,200 L 980,120 L 980,280 Z';
}

function bottlePath(): string {
  return 'M 380,40 L 580,40 L 580,140 Q 700,160 720,260 L 720,340 Q 720,380 680,380 L 280,380 Q 240,380 240,340 L 240,260 Q 260,160 380,140 Z';
}

function guitarPath(): string {
  return 'M 40,180 L 580,180 L 580,170 A 130 130 0 1 1 580,230 L 580,220 L 40,220 Z';
}

function umbrellaPath(): string {
  // Vertical: canopy at top, stick going down.
  return 'M 40,300 Q 200,40 360,300 Z M 190,300 L 210,800 L 240,820 L 220,840 L 180,820 L 200,800 Z';
}

function mortarPath(): string {
  return 'M 80,80 L 320,80 L 280,200 L 320,920 Q 320,960 200,960 Q 80,960 80,920 L 120,200 Z';
}
