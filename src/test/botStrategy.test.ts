import { describe, expect, it } from 'vitest';
import { chooseDeterministicBotIntent } from '../../server/src/botStrategy';

describe('deterministic bot strategy', () => {
  it('chooses from server-generated legal intents only', () => {
    const legalIntents = [
      { type: 'draw' },
      { type: 'play_card', cardId: 'card-7-circle' },
    ];

    const selected = chooseDeterministicBotIntent({
      gameType: 'whot',
      botPlayerId: 'bot:run:1',
      legalIntents,
      publicState: { currentPlayerId: 'bot:run:1' },
      privateState: { handCount: 3 },
      turnNumber: 1,
    });

    expect(legalIntents).toContainEqual(selected);
    expect(selected).toEqual({ type: 'play_card', cardId: 'card-7-circle' });
  });

  it('is stable for the same state and turn', () => {
    const input = {
      gameType: 'ludo',
      botPlayerId: 'bot:run:2',
      legalIntents: [
        { type: 'move_token', tokenIndex: 0, steps: 6 },
        { type: 'move_token', tokenIndex: 1, steps: 6 },
      ],
      publicState: { currentPlayerId: 'bot:run:2' },
      privateState: { legal: true },
      turnNumber: 4,
    };

    expect(chooseDeterministicBotIntent(input)).toEqual(chooseDeterministicBotIntent(input));
  });

  it('returns null when no legal intent exists', () => {
    expect(chooseDeterministicBotIntent({
      gameType: 'whot',
      botPlayerId: 'bot:run:1',
      legalIntents: [],
      publicState: {},
      privateState: {},
      turnNumber: 1,
    })).toBeNull();
  });
});
