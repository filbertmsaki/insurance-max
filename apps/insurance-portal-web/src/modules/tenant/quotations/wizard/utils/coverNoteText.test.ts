import { describe, expect, it } from 'vitest';
import {
  applyCoverNoteTemplate,
  buildDefaultCoverNoteDescription,
  buildDefaultOperativeClause,
} from './coverNoteText';

describe('applyCoverNoteTemplate', () => {
  it('replaces all occurrences of a placeholder', () => {
    const result = applyCoverNoteTemplate('{a} and {a} and {b}', {
      a: 'X',
      b: 'Y',
    });
    expect(result).toBe('X and X and Y');
  });
});

describe('buildDefaultCoverNoteDescription', () => {
  it('returns null when no product is selected', () => {
    expect(
      buildDefaultCoverNoteDescription('', '2026-07-30', '2027-07-29'),
    ).toBeNull();
    expect(
      buildDefaultCoverNoteDescription(null, '2026-07-30', '2027-07-29'),
    ).toBeNull();
    expect(
      buildDefaultCoverNoteDescription(undefined, '2026-07-30', '2027-07-29'),
    ).toBeNull();
  });

  it('generates the full sentence with product and cover period, formatted as DD/MM/YYYY', () => {
    const result = buildDefaultCoverNoteDescription(
      'Motor Private',
      '2026-07-30',
      '2027-07-29',
    );
    expect(result).toBe(
      'Cover note for Motor Private for the period from 30/07/2026 to 29/07/2027.',
    );
  });

  it('generates a partial description without dates when cover dates are incomplete', () => {
    expect(buildDefaultCoverNoteDescription('Motor Private', '', '')).toBe(
      'Cover note for Motor Private.',
    );
    expect(
      buildDefaultCoverNoteDescription('Motor Private', '2026-07-30', null),
    ).toBe('Cover note for Motor Private.');
    expect(
      buildDefaultCoverNoteDescription('Motor Private', null, '2027-07-29'),
    ).toBe('Cover note for Motor Private.');
  });

  it('never surfaces undefined/null/invalid text in the output', () => {
    const result = buildDefaultCoverNoteDescription(
      'Motor Private',
      'not-a-date',
      'also-not-a-date',
    );
    expect(result).not.toMatch(/undefined|null|NaN/);
    expect(result).toBe('Cover note for Motor Private.');
  });
});

describe('buildDefaultOperativeClause', () => {
  it('returns null when no product is selected', () => {
    expect(
      buildDefaultOperativeClause('', '2026-07-30', '2027-07-29'),
    ).toBeNull();
  });

  it('generates the full clause with product and cover period', () => {
    const result = buildDefaultOperativeClause(
      'Motor Private',
      '2026-07-30',
      '2027-07-29',
    );
    expect(result).toContain('Motor Private');
    expect(result).toContain('30/07/2026');
    expect(result).toContain('29/07/2027');
  });

  it('generates a partial clause when cover dates are incomplete', () => {
    const result = buildDefaultOperativeClause('Motor Private', '', '');
    expect(result).not.toMatch(/undefined|null|NaN/);
    expect(result).toContain('Motor Private');
  });
});
