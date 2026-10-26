import { describe, expect, it } from 'vitest';
import { parseFleetQuickAdd } from './fleetQuickAdd';

describe('parseFleetQuickAdd', () => {
  it('reads one plate per line and ignores blank lines', () => {
    const { rows, errors } = parseFleetQuickAdd('T123ABC\n\n t 456 def \n');
    expect(errors).toEqual([]);
    expect(rows.map((row) => row.registration_number)).toEqual([
      'T123ABC',
      'T456DEF',
    ]);
  });

  it('reads a sum insured after a tab, comma or trailing number', () => {
    const { rows } = parseFleetQuickAdd(
      'T123ABC\t25000000\nT124ABC,25,000,000\nT 125 ABC 30000000',
    );
    expect(rows.map((row) => [row.registration_number, row.sum_insured])).toEqual(
      [
        ['T123ABC', '25000000'],
        ['T124ABC', '25000000'],
        ['T125ABC', '30000000'],
      ],
    );
  });

  it('treats long identifiers as chassis numbers', () => {
    const { rows } = parseFleetQuickAdd('NCP314345436334');
    expect(rows[0].chassis_number).toBe('NCP314345436334');
    expect(rows[0].registration_number).toBe('');
  });

  it('skips duplicates within the paste and against the fleet', () => {
    const { rows, duplicates } = parseFleetQuickAdd(
      'T123ABC\nt123abc\nT999ZZZ',
      ['T999ZZZ'],
    );
    expect(rows).toHaveLength(1);
    expect(duplicates).toEqual(['T123ABC', 'T999ZZZ']);
  });

  it('reports invalid lines and amounts', () => {
    const { rows, errors } = parseFleetQuickAdd('T123ABC, lots\n@@@');
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(2);
  });
});
