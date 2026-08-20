import { BadRequestException, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';

const TIRA_DATETIME_FORMAT = "yyyy-MM-dd'T'HH:mm:ss";
const TIRA_TIMEZONE = 'Africa/Dar_es_Salaam';
const MINIMUM_START_GAP_SECONDS = 10;

export interface TiramisCoverPeriod {
  startDateTime: string;
  endDateTime: string;
  durationMilliseconds: number;
  adjusted: boolean;
}

@Injectable()
export class TiramisCoverPeriodService {
  normalize(
    startValue: Date | string,
    endValue: Date | string,
    now: Date = new Date(),
  ): TiramisCoverPeriod {
    const originalStart = this.parse(startValue, 'Cover Note Start Date/Time');
    const originalEnd = this.parse(endValue, 'Cover Note End Date/Time');
    const durationMilliseconds =
      originalEnd.toMillis() - originalStart.toMillis();

    if (durationMilliseconds <= 0) {
      throw new BadRequestException(
        'Cover Note End Date/Time must be later than Start Date/Time',
      );
    }

    // Round upward to a whole second before adding the safety gap. This keeps
    // the second-precision value sent to TIRA at least ten full seconds ahead.
    const serverNow = DateTime.fromJSDate(now, { zone: TIRA_TIMEZONE });
    const roundedServerNow =
      serverNow.millisecond === 0
        ? serverNow
        : serverNow.startOf('second').plus({ seconds: 1 });
    const minimumStart = roundedServerNow.plus({
      seconds: MINIMUM_START_GAP_SECONDS,
    });
    const adjusted = originalStart.toMillis() < minimumStart.toMillis();
    const start = adjusted ? minimumStart : originalStart;
    const end = adjusted
      ? start.plus({ milliseconds: durationMilliseconds })
      : originalEnd;

    return {
      startDateTime: start.toFormat(TIRA_DATETIME_FORMAT),
      endDateTime: end.toFormat(TIRA_DATETIME_FORMAT),
      durationMilliseconds,
      adjusted,
    };
  }

  normalizeRequestXml(xml: string, now: Date = new Date()) {
    const start = this.readElement(xml, 'CoverNoteStartDate');
    const end = this.readElement(xml, 'CoverNoteEndDate');
    const period = this.normalize(start, end, now);

    return {
      ...period,
      xml: this.replaceElement(
        this.replaceElement(xml, 'CoverNoteStartDate', period.startDateTime),
        'CoverNoteEndDate',
        period.endDateTime,
      ),
    };
  }

  private parse(value: Date | string, fieldName: string): DateTime {
    let parsed: DateTime;

    if (value instanceof Date) {
      parsed = DateTime.fromJSDate(value, { zone: TIRA_TIMEZONE });
    } else {
      const input = String(value || '').trim();
      parsed = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(input)
        ? DateTime.fromISO(input, { setZone: true }).setZone(TIRA_TIMEZONE)
        : DateTime.fromISO(input, { zone: TIRA_TIMEZONE });
    }

    if (!parsed.isValid) {
      throw new BadRequestException(
        `${fieldName} must use the format YYYY-MM-DDTHH:mm:ss`,
      );
    }

    return parsed;
  }

  private readElement(xml: string, elementName: string): string {
    const match = new RegExp(
      `<${elementName}[^>]*>([^<]+)</${elementName}>`,
      'i',
    ).exec(xml);

    if (!match?.[1]) {
      throw new BadRequestException(
        `Stored TIRAMIS request XML is missing ${elementName}`,
      );
    }

    return match[1].trim();
  }

  private replaceElement(
    xml: string,
    elementName: string,
    value: string,
  ): string {
    return xml.replace(
      new RegExp(`(<${elementName}[^>]*>)[^<]*(</${elementName}>)`, 'gi'),
      `$1${value}$2`,
    );
  }
}
