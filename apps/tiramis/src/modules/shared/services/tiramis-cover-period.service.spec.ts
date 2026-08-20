import { BadRequestException } from '@nestjs/common';

import { TiramisCoverPeriodService } from './tiramis-cover-period.service';

describe('TiramisCoverPeriodService', () => {
  const service = new TiramisCoverPeriodService();
  const now = new Date('2026-08-20T07:03:28.000Z');

  it('moves a past start ten seconds ahead and preserves duration', () => {
    const result = service.normalize(
      '2026-08-01T10:03:28',
      '2026-08-31T10:03:28',
      now,
    );

    expect(result).toMatchObject({
      startDateTime: '2026-08-20T10:03:38',
      endDateTime: '2026-09-19T10:03:38',
      adjusted: true,
    });
  });

  it('rounds upward so second precision retains the full safety gap', () => {
    const result = service.normalize(
      '2026-08-01T10:03:28',
      '2026-08-31T10:03:28',
      new Date('2026-08-20T07:03:28.900Z'),
    );

    expect(result.startDateTime).toBe('2026-08-20T10:03:39');
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

  it('updates stored retry XML dates while preserving duration', () => {
    const result = service.normalizeRequestXml(
      '<TiraMsg><MotorCoverNoteRefReq><CoverNoteStartDate>2026-08-01T10:03:28</CoverNoteStartDate><CoverNoteEndDate>2026-08-31T10:03:28</CoverNoteEndDate></MotorCoverNoteRefReq><MsgSignature>old</MsgSignature></TiraMsg>',
      now,
    );

    expect(result.xml).toContain(
      '<CoverNoteStartDate>2026-08-20T10:03:38</CoverNoteStartDate>',
    );
    expect(result.xml).toContain(
      '<CoverNoteEndDate>2026-09-19T10:03:38</CoverNoteEndDate>',
    );
  });

  it('rejects a non-positive original duration', () => {
    expect(() =>
      service.normalize('2026-08-31T10:03:28', '2026-08-01T10:03:28', now),
    ).toThrow(BadRequestException);
  });
});
