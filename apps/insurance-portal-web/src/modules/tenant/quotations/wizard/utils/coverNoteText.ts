import { formatCoverDate } from '../../utils/coverPeriod';

export const DEFAULT_COVER_NOTE_DESCRIPTION_TEMPLATE =
  'Cover note for {productName} for the period from {coverStartDate} to {coverEndDate}.';
export const DEFAULT_COVER_NOTE_DESCRIPTION_TEMPLATE_NO_PERIOD =
  'Cover note for {productName}.';

export const DEFAULT_OPERATIVE_CLAUSE_TEMPLATE =
  'This cover note is issued in respect of {productName} and shall be operative for the period from {coverStartDate} to {coverEndDate}.';
export const DEFAULT_OPERATIVE_CLAUSE_TEMPLATE_NO_PERIOD =
  'This cover note is issued in respect of {productName} and shall be operative in accordance with the terms of this cover note.';

/** Replaces `{placeholder}` tokens in a template with the given values. */
export function applyCoverNoteTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.split(`{${key}}`).join(value),
    template,
  );
}

function buildCoverNoteText(
  productName: string | null | undefined,
  coverStartDate: string | null | undefined,
  coverEndDate: string | null | undefined,
  templateWithPeriod: string,
  templateWithoutPeriod: string,
): string | null {
  const name = productName?.trim();
  if (!name) return null;

  const startDate = formatCoverDate(coverStartDate);
  const endDate = formatCoverDate(coverEndDate);

  if (startDate && endDate) {
    return applyCoverNoteTemplate(templateWithPeriod, {
      productName: name,
      coverStartDate: startDate,
      coverEndDate: endDate,
    });
  }

  return applyCoverNoteTemplate(templateWithoutPeriod, { productName: name });
}

/** Builds the default Cover Note Description from the selected product name and cover period. Returns null while the product is not yet selected. */
export function buildDefaultCoverNoteDescription(
  productName: string | null | undefined,
  coverStartDate: string | null | undefined,
  coverEndDate: string | null | undefined,
  template: string = DEFAULT_COVER_NOTE_DESCRIPTION_TEMPLATE,
  templateWithoutPeriod: string = DEFAULT_COVER_NOTE_DESCRIPTION_TEMPLATE_NO_PERIOD,
): string | null {
  return buildCoverNoteText(
    productName,
    coverStartDate,
    coverEndDate,
    template,
    templateWithoutPeriod,
  );
}

/** Builds the default Operative Clause from the selected product name and cover period. Returns null while the product is not yet selected. */
export function buildDefaultOperativeClause(
  productName: string | null | undefined,
  coverStartDate: string | null | undefined,
  coverEndDate: string | null | undefined,
  template: string = DEFAULT_OPERATIVE_CLAUSE_TEMPLATE,
  templateWithoutPeriod: string = DEFAULT_OPERATIVE_CLAUSE_TEMPLATE_NO_PERIOD,
): string | null {
  return buildCoverNoteText(
    productName,
    coverStartDate,
    coverEndDate,
    template,
    templateWithoutPeriod,
  );
}
