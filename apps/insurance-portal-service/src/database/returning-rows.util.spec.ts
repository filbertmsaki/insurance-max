import { returningRows } from './returning-rows.util';

describe('returningRows', () => {
  it('unwraps the [rows, rowCount] shape of UPDATE/DELETE ... RETURNING', () => {
    expect(returningRows([[{ id: 'a' }, { id: 'b' }], 2])).toEqual([
      { id: 'a' },
      { id: 'b' },
    ]);
  });

  it('unwraps an UPDATE that matched nothing', () => {
    expect(returningRows([[], 0])).toEqual([]);
  });

  it('passes SELECT/INSERT rows through unchanged', () => {
    expect(returningRows([{ id: 'a' }])).toEqual([{ id: 'a' }]);
  });

  it('does not mistake two plain rows for the UPDATE shape', () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    expect(returningRows(rows)).toBe(rows);
  });

  it('returns no rows for a non-array result', () => {
    expect(returningRows(undefined)).toEqual([]);
  });
});
