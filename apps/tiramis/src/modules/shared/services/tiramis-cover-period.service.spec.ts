import { BadRequestException } from '@nestjs/common';

import { TiramisCoverPeriodService } from './tiramis-cover-period.service';

describe('TiramisCoverPeriodService', () => {
  const service = new TiramisCoverPeriodService();
  const now = new Date('2026-08-20T07:03:28.000Z');

  it('moves a past start five seconds ahead and preserves duration', () => {
    const result = service.normalize(
      '2026-08-01T10:03:28',
      '2026-08-31T10:03:28',
      now,
    );

    expect(result).toMatchObject({
      startDateTime: '2026-08-20T10:03:34',
      endDateTime: '2026-09-19T10:03:34',
      adjusted: true,
    });
  });

  it('keeps an inclusive end on the preceding calendar day after a same-day adjustment', () => {
    const result = service.normalize(
      '2026-08-20T10:03:28',
      '2027-08-19T23:59:59',
      now,
    );

    expect(result.startDateTime).toBe('2026-08-20T10:03:34');
    expect(result.endDateTime).toBe('2027-08-19T23:59:59');
  });

  it('moves an inclusive end by calendar days when a stale start is retried', () => {
    const result = service.normalize(
      '2026-08-01T10:03:28',
      '2027-07-31T23:59:59',
      now,
    );

    expect(result.startDateTime).toBe('2026-08-20T10:03:34');
    expect(result.endDateTime).toBe('2027-08-19T23:59:59');
  });

  it('keeps a retried annual period on the day before its anniversary across a leap year', () => {
    const result = service.normalize(
      '2027-10-14T10:03:28',
      '2028-10-13T23:59:59',
      new Date('2028-10-14T07:03:28.000Z'),
    );

    expect(result.startDateTime).toBe('2028-10-14T10:03:34');
    expect(result.endDateTime).toBe('2029-10-13T23:59:59');
  });

  it.each([30, 60, 90])(
    'preserves exactly %i days after adjustment',
    (days) => {
      const originalStart = '2026-08-01T10:03:28';
      const originalEnd = new Date(
        Date.parse('2026-08-01T07:03:28Z') + days * 24 * 60 * 60 * 1000,
      ).toISOString();
      const result = service.normalize(originalStart, originalEnd, now);

      expect(result.durationMilliseconds).toBe(days * 24 * 60 * 60 * 1000);
      expect(
        service.toDate(result.endDateTime).getTime() -
          service.toDate(result.startDateTime).getTime(),
      ).toBe(result.durationMilliseconds);
    },
  );

  it('rounds upward so second precision retains the full safety gap', () => {
    const result = service.normalize(
      '2026-08-01T10:03:28',
      '2026-08-31T10:03:28',
      new Date('2026-08-20T07:03:28.900Z'),
    );

    expect(result.startDateTime).toBe('2026-08-20T10:03:34');
  });

  it('does not modify a sufficiently future cover period', () => {
    const result = service.normalize(
      '2026-08-21T10:03:28',
      '2026-09-20T10:03:28',
      now,
    );

    expect(result).toMatchObject({
      startDateTime: '2026-08-21T10:03:28',
      endDateTime: '2026-09-20T10:03:28',
      adjusted: false,
    });
  });

  it('retains a start strictly beyond now plus five seconds', () => {
    const result = service.normalize(
      '2026-08-20T10:03:34',
      '2026-09-19T10:03:34',
      now,
    );

    expect(result.adjusted).toBe(false);
    expect(result.startDateTime).toBe('2026-08-20T10:03:34');
    expect(result.endDateTime).toBe('2026-09-19T10:03:34');
  });

  it('adjusts a start equal to now plus five seconds', () => {
    const result = service.normalize(
      '2026-08-20T10:03:33',
      '2026-09-19T10:03:33',
      now,
    );

    expect(result.adjusted).toBe(true);
    expect(result.startDateTime).toBe('2026-08-20T10:03:34');
    expect(result.durationMilliseconds).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('does not lose the five-second margin when the source has milliseconds', () => {
    const result = service.normalize(
      '2026-08-20T10:03:33.100',
      '2026-09-19T10:03:33.100',
      now,
    );

    expect(result.adjusted).toBe(true);
    expect(result.startDateTime).toBe('2026-08-20T10:03:34');
    expect(result.endDateTime).toBe('2026-09-19T10:03:34');
  });

  it('updates stored retry XML dates while preserving duration', () => {
    const result = service.normalizeRequestXml(
      '<TiraMsg><MotorCoverNoteRefReq><CoverNoteStartDate>2026-08-01T10:03:28</CoverNoteStartDate><CoverNoteEndDate>2026-08-31T10:03:28</CoverNoteEndDate></MotorCoverNoteRefReq><MsgSignature>old</MsgSignature></TiraMsg>',
      now,
    );

    expect(result.xml).toContain(
      '<CoverNoteStartDate>2026-08-20T10:03:34</CoverNoteStartDate>',
    );
    expect(result.xml).toContain(
      '<CoverNoteEndDate>2026-09-19T10:03:34</CoverNoteEndDate>',
    );
  });

  it('rejects a non-positive original duration', () => {
    expect(() =>
      service.normalize('2026-08-31T10:03:28', '2026-08-01T10:03:28', now),
    ).toThrow(BadRequestException);
  });

  it('rejects a fractional-second duration that TIRA XML cannot preserve', () => {
    expect(() =>
      service.normalize(
        '2026-08-20T10:03:33.100',
        '2026-09-19T10:03:33.200',
        now,
      ),
    ).toThrow('Cover period duration must use whole seconds');
  });
});
