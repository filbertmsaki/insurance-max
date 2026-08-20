import { BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';

const FORMAT = "yyyy-MM-dd'T'HH:mm:ss";
const TIMEZONE = 'Africa/Dar_es_Salaam';
const SAFETY_GAP_SECONDS = 10;

export function normalizeQuotationCoverPeriod(
  startValue: Date | string,
  endValue: Date | string,
  now: Date = new Date(),
) {
  const start = parseDateTime(startValue, 'Cover Note Start Date/Time');
  const end = parseDateTime(endValue, 'Cover Note End Date/Time');
  const durationMilliseconds = end.toMillis() - start.toMillis();

  if (durationMilliseconds <= 0) {
    throw new BadRequestException(
      'Cover Note End Date/Time must be later than Start Date/Time',
    );
  }

  const serverNow = DateTime.fromJSDate(now, { zone: TIMEZONE });
  const roundedNow =
    serverNow.millisecond === 0
      ? serverNow
      : serverNow.startOf('second').plus({ seconds: 1 });
  const minimumStart = roundedNow.plus({ seconds: SAFETY_GAP_SECONDS });
  const adjusted = start.toMillis() < minimumStart.toMillis();
  const normalizedStart = adjusted ? minimumStart : start;
  const normalizedEnd = adjusted
    ? normalizedStart.plus({ milliseconds: durationMilliseconds })
    : end;

  return {
    startDateTime: normalizedStart.toFormat(FORMAT),
    endDateTime: normalizedEnd.toFormat(FORMAT),
    startDate: normalizedStart.toJSDate(),
    endDate: normalizedEnd.toJSDate(),
    durationMilliseconds,
    adjusted,
  };
}

function parseDateTime(value: Date | string, fieldName: string): DateTime {
  const parsed =
    value instanceof Date
      ? DateTime.fromJSDate(value, { zone: TIMEZONE })
      : /(?:Z|[+-]\d{2}:?\d{2})$/i.test(String(value || '').trim())
        ? DateTime.fromISO(String(value).trim(), { setZone: true }).setZone(
            TIMEZONE,
          )
        : DateTime.fromISO(String(value || '').trim(), { zone: TIMEZONE });

  if (!parsed.isValid) {
    throw new BadRequestException(
      `${fieldName} must use the format YYYY-MM-DDTHH:mm:ss`,
    );
  }

  return parsed;
}
