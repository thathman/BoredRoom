function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function intentPriority(intent: Record<string, unknown>): number {
  const type = String(intent.type ?? '');
  switch (type) {
    case 'roll':
      return 1000;
    case 'play_card':
      return 920;
    case 'move_token':
      return 900 + numberValue(intent.steps, 0) + numberValue(intent.tokenIndex, 0) / 100;
    case 'drop':
    case 'place':
      return 820;
    case 'answer':
    case 'answer_text':
    case 'guess':
      return 760;
    case 'request_shape':
      return 500;
    case 'draw':
      return 260;
    case 'advance':
      return 120;
    default:
      return 400;
  }
}

export function chooseDeterministicBotIntent(input: {
  gameType: string;
  botPlayerId: string;
  legalIntents: Array<Record<string, unknown>>;
  publicState: unknown;
  privateState: unknown;
  turnNumber: number;
}): Record<string, unknown> | null {
  if (input.legalIntents.length === 0) return null;
  const seed = stableHash(`${input.gameType}:${input.botPlayerId}:${input.turnNumber}:${JSON.stringify(input.publicState).slice(0, 800)}:${JSON.stringify(input.privateState).slice(0, 400)}`);
  const ranked = input.legalIntents
    .map((intent, index) => ({
      intent,
      score: intentPriority(intent) + ((stableHash(`${seed}:${index}:${JSON.stringify(intent)}`) % 997) / 10_000),
    }))
    .sort((a, b) => b.score - a.score);
  return { ...ranked[0].intent };
}
