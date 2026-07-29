type DateParts = {
  day: number;
  month: number;
  year: number;
};

function validDateParts(parts: DateParts): DateParts | null {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));

  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() !== parts.month - 1 ||
    date.getUTCDate() !== parts.day
  ) {
    return null;
  }

  return parts;
}

function parseDateParts(value: string): DateParts | null {
  const normalized = value.trim();
  const yearFirst = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);

  // Read the calendar date directly from ISO-like values to avoid timezone
  // conversion changing date-only cover periods.
  if (yearFirst) {
    return validDateParts({
      year: Number(yearFirst[1]),
      month: Number(yearFirst[2]),
      day: Number(yearFirst[3]),
    });
  }

  const slashDate = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (slashDate) {
    const first = Number(slashDate[1]);
    const second = Number(slashDate[2]);
    const year = Number(slashDate[3]);

    // Prefer DD/MM/YYYY, while accepting unambiguous MM/DD/YYYY values.
    const day = first > 12 ? first : second > 12 ? second : first;
    const month = first > 12 ? second : second > 12 ? first : second;

    return validDateParts({ year, month, day });
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;

  return validDateParts({
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
  });
}

export function formatCoverDate(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;

  const parts = parseDateParts(value);
  if (!parts) return null;

  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year}`;
}

export function formatCoverPeriod(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string {
  const start = formatCoverDate(startDate) ?? 'N/A';
  const end = formatCoverDate(endDate) ?? 'N/A';

  return start === 'N/A' && end === 'N/A' ? 'N/A' : `${start} - ${end}`;
}
