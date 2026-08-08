import { DateTime } from 'luxon';

import {
  RegulatoryDueRuleType,
  RegulatoryOffsetUnit,
} from '../enums/regulatory.enums';
import { RegulatoryDueDateService } from './regulatory-due-date.service';

describe('RegulatoryDueDateService', () => {
  const service = new RegulatoryDueDateService();
  const timezone = 'Africa/Dar_es_Salaam';

  it('moves weekend due dates to the next working day when configured', () => {
    const dueDate = service.calculateDueDateFromRule(
      {
        type: 'DAY_OF_MONTH_AFTER_PERIOD',
        monthsAfterPeriod: 1,
        day: 1,
        adjustForWeekend: true,
        weekendAdjustment: 'NEXT_WORKING_DAY',
      },
      DateTime.fromISO('2026-07-31T12:00:00', { zone: timezone }),
      timezone,
    );

    expect(DateTime.fromJSDate(dueDate).setZone(timezone).toISODate()).toBe(
      '2026-08-03',
    );
  });

  it('supports fixed-date rules in the company timezone', () => {
    const dueDate = service.calculateDueDate(
      {
        due_rule_type: RegulatoryDueRuleType.FIXED_DATE,
        fixed_month: 6,
        fixed_day: 30,
      } as any,
      DateTime.fromISO('2026-12-31T10:00:00', { zone: timezone }),
      timezone,
    );

    expect(DateTime.fromJSDate(dueDate).setZone(timezone).toISODate()).toBe(
      '2026-06-30',
    );
  });

  it('applies configured period-end offsets', () => {
    const dueDate = service.calculateDueDate(
      {
        due_rule_type: RegulatoryDueRuleType.PERIOD_END_OFFSET,
        offset_unit: RegulatoryOffsetUnit.CALENDAR_DAYS,
        offset_value: 15,
      } as any,
      DateTime.fromISO('2026-03-31T10:00:00', { zone: timezone }),
      timezone,
    );

    expect(DateTime.fromJSDate(dueDate).setZone(timezone).toISODate()).toBe(
      '2026-04-15',
    );
  });
});
