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
    return this.calculateDueDateFromConfiguration(
      {
        due_rule_type: template.due_rule_type,
        fixed_day: template.fixed_day ?? null,
        fixed_month: template.fixed_month ?? null,
        offset_unit: template.offset_unit ?? null,
        offset_value: template.offset_value ?? null,
      },
      periodEnd,
      timezone,
    );
  }

  calculateDueDateFromRule(
    rule: Record<string, unknown>,
    periodEnd: DateTime,
    timezone: string,
  ): Date {
    const localizedPeriodEnd = periodEnd.setZone(timezone);
    const type =
      typeof rule.type === 'string' ? rule.type : 'DAY_OF_MONTH_AFTER_PERIOD';

    if (type === 'DAY_OF_MONTH_AFTER_PERIOD') {
      const monthsAfterPeriod = this.numberOrDefault(rule.monthsAfterPeriod, 1);
      const day = this.numberOrDefault(rule.day, 1);
      const adjustForWeekend = Boolean(rule.adjustForWeekend);
      const weekendAdjustment =
        typeof rule.weekendAdjustment === 'string'
          ? rule.weekendAdjustment
          : 'NEXT_WORKING_DAY';

      let due: DateTime = localizedPeriodEnd
        .plus({ month: monthsAfterPeriod })
        .startOf('month')
        .set({ day });

      if (adjustForWeekend) {
        due = this.adjustWeekend(due, weekendAdjustment);
      }

      return due.endOf('day').toJSDate();
    }

    if (type === 'FIXED_DATE') {
      let due: DateTime = DateTime.fromObject(
        {
          year: localizedPeriodEnd.year,
          month: this.numberOrDefault(rule.month, localizedPeriodEnd.month),
          day: this.numberOrDefault(rule.day, 1),
        },
        { zone: timezone },
      );

      if (rule.adjustForWeekend) {
        due = this.adjustWeekend(
          due,
          typeof rule.weekendAdjustment === 'string'
            ? rule.weekendAdjustment
            : 'NEXT_WORKING_DAY',
        );
      }

      return due.endOf('day').toJSDate();
    }

    return this.calculateDueDateFromConfiguration(
      {
        due_rule_type: RegulatoryDueRuleType.PERIOD_END_OFFSET,
        fixed_day: null,
        fixed_month: null,
        offset_unit:
          typeof rule.offsetUnit === 'string'
            ? (rule.offsetUnit as RegulatoryOffsetUnit)
            : RegulatoryOffsetUnit.CALENDAR_DAYS,
        offset_value: this.numberOrDefault(rule.offsetValue, 0),
      },
      periodEnd,
      timezone,
    );
  }

  private calculateDueDateFromConfiguration(
    template: Pick<
      RegulatoryObligationTemplate,
      | 'due_rule_type'
      | 'fixed_day'
      | 'fixed_month'
      | 'offset_unit'
      | 'offset_value'
    >,
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

  private adjustWeekend(date: DateTime, mode: string): DateTime {
    if (date.weekday <= 5) {
      return date;
    }

    if (mode === 'PREVIOUS_WORKING_DAY') {
      let adjusted = date;
      while (adjusted.weekday > 5) {
        adjusted = adjusted.minus({ day: 1 });
      }
      return adjusted;
    }

    let adjusted = date;
    while (adjusted.weekday > 5) {
      adjusted = adjusted.plus({ day: 1 });
    }
    return adjusted;
  }

  private numberOrDefault(value: unknown, fallback: number) {
    const numeric =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : Number.NaN;

    return Number.isFinite(numeric) ? numeric : fallback;
  }

  private applyOffset(
    date: DateTime,
    offsetValue: number,
    offsetUnit: RegulatoryOffsetUnit,
  ): DateTime {
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
