import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';

import { RegulatoryObligationTemplate } from '../entities/regulatory-obligation-template.entity';
import {
  RegulatoryDueRuleType,
  RegulatoryOffsetUnit,
} from '../enums/regulatory.enums';

@Injectable()
export class RegulatoryDueDateService {
  calculateDueDate(
    template: RegulatoryObligationTemplate,
    periodEnd: DateTime,
    timezone: string,
  ): Date {
    const localizedPeriodEnd = periodEnd.setZone(timezone);

    switch (template.due_rule_type) {
      case RegulatoryDueRuleType.FIXED_DATE:
        return DateTime.fromObject(
          {
            year: localizedPeriodEnd.year,
            month: template.fixed_month ?? localizedPeriodEnd.month,
            day: template.fixed_day ?? 1,
          },
          { zone: timezone },
        )
          .endOf('day')
          .toJSDate();
      case RegulatoryDueRuleType.EVENT_OFFSET:
      case RegulatoryDueRuleType.PERIOD_END_OFFSET:
      default:
        return this.applyOffset(
          localizedPeriodEnd,
          template.offset_value ?? 0,
          template.offset_unit ?? RegulatoryOffsetUnit.CALENDAR_DAYS,
        )
          .endOf('day')
          .toJSDate();
    }
  }

  private applyOffset(
    date: DateTime,
    offsetValue: number,
    offsetUnit: RegulatoryOffsetUnit,
  ) {
    switch (offsetUnit) {
      case RegulatoryOffsetUnit.MONTHS:
        return date.plus({ month: offsetValue });
      case RegulatoryOffsetUnit.WORKING_DAYS:
      case RegulatoryOffsetUnit.CALENDAR_DAYS:
      default:
        return date.plus({ day: offsetValue });
    }
  }
}
