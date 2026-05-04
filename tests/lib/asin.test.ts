import { describe, it, expect } from 'vitest';
import { ASIN_LENGTH, ASIN_REGEX, isValidAsin, normalizeAsins } from '../../src/lib/asin.js';

describe('ASIN constants', () => {
  it('ASIN_LENGTH is 10', () => {
    expect(ASIN_LENGTH).toBe(10);
  });

  it('ASIN_REGEX matches uppercase 10-char alphanumeric', () => {
    expect(ASIN_REGEX.test('B00MNV8E0C')).toBe(true);
  });
});

describe('isValidAsin', () => {
  it('accepts modern Amazon ASINs (B0 + 8 alphanumeric)', () => {
    expect(isValidAsin('B07XYZ1234')).toBe(true);
    expect(isValidAsin('B00MNV8E0C')).toBe(true);
  });

  it('accepts numeric ISBN-10 ASINs', () => {
    expect(isValidAsin('0345391802')).toBe(true);
    // Note: 1234567890 is structurally valid ISBN-10 shape; whether Keepa has it is a different question.
    expect(isValidAsin('1234567890')).toBe(true);
  });

  it('accepts ISBN-10 with X check digit', () => {
    expect(isValidAsin('043942089X')).toBe(true);
  });

  it('rejects strings that are too short or too long', () => {
    expect(isValidAsin('B07XYZ')).toBe(false);
    expect(isValidAsin('B07XYZ12345')).toBe(false);
    expect(isValidAsin('')).toBe(false);
  });

  it('rejects lowercase (callers should normalize first)', () => {
    expect(isValidAsin('b00mnv8e0c')).toBe(false);
  });

  it('rejects non-alphanumeric characters', () => {
    expect(isValidAsin('B07XYZ-123')).toBe(false);
    expect(isValidAsin('B07 XYZ123')).toBe(false);
    expect(isValidAsin('B07.XYZ123')).toBe(false);
  });
});

describe('normalizeAsins', () => {
  it('uppercases and trims input', () => {
    expect(normalizeAsins(['  b00mnv8e0c  '])).toEqual(['B00MNV8E0C']);
    expect(normalizeAsins(['b07xyz1234', 'B00MNV8E0C'])).toEqual(['B07XYZ1234', 'B00MNV8E0C']);
  });

  it('returns the list unchanged when already normalized', () => {
    expect(normalizeAsins(['B07XYZ1234', 'B00MNV8E0C'])).toEqual(['B07XYZ1234', 'B00MNV8E0C']);
  });

  it('throws with all invalid ASINs listed in the message', () => {
    expect(() => normalizeAsins(['B07XYZ1234', 'too-short', 'B07_BAD'])).toThrow(
      /Invalid ASIN/,
    );
    expect(() => normalizeAsins(['B07XYZ1234', 'too-short'])).toThrow(/TOO-SHORT/);
    expect(() => normalizeAsins(['bad1', 'bad2'])).toThrow(/BAD1.*BAD2|BAD2.*BAD1/);
  });

  it('returns [] for empty input — Products.list guards asins.length === 0 separately', () => {
    expect(() => normalizeAsins([])).not.toThrow();
    expect(normalizeAsins([])).toEqual([]);
  });
});
