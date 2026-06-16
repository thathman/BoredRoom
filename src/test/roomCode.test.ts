import { describe, expect, it } from 'vitest';
import {
  isValidRoomCode,
  normalizeRoomCode,
  ROOM_CODE_ALPHABET,
} from '../../shared/src/roomCodes';

describe('room code validation', () => {
  it('normalizes typed or scanned codes into uppercase compact codes', () => {
    expect(normalizeRoomCode(' ab-c2 ')).toBe('ABC2');
    expect(normalizeRoomCode('wxyz-extra')).toBe('WXYZ');
  });

  it('accepts only the non-ambiguous room-code alphabet', () => {
    expect(isValidRoomCode('ABCD')).toBe(true);
    expect(isValidRoomCode('A2Z9')).toBe(true);
    expect(isValidRoomCode('O0I1')).toBe(false);
    expect(isValidRoomCode('ABC')).toBe(false);
    expect(isValidRoomCode('ABCDE')).toBe(true);
  });

  it('keeps alphabet free of common camera/typing confusables', () => {
    expect(ROOM_CODE_ALPHABET).not.toContain('O');
    expect(ROOM_CODE_ALPHABET).not.toContain('0');
    expect(ROOM_CODE_ALPHABET).not.toContain('I');
    expect(ROOM_CODE_ALPHABET).not.toContain('1');
  });
});
