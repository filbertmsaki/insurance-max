import { TiraStatus } from '../enums/tira-status.enum';
import type { Quotation } from '../entities/quotation.entity';
import type { QuotationDisplayStatusResolver } from '../services/quotation-display-status.resolver';
import { QuotationPayloadMapper } from './quotation-payload.mapper';

function quotation(overrides: Partial<Quotation>): Quotation {
  return {
    id: 'q-1',
    quotation_no: 'AICL261109011',
    tira_status: TiraStatus.SUCCESS,
    tira_response_code: 'E101',
    tira_response_description: 'Vehicle already insured',
    cover_note: null,
    product: null,
    submitted_at: null,
    created_at: new Date('2026-11-09T11:32:00Z'),
    updated_at: new Date('2026-11-09T11:32:00Z'),
    ...overrides,
  } as unknown as Quotation;
}

describe('QuotationPayloadMapper.toListItem', () => {
  const mapper = new QuotationPayloadMapper({
    resolve: () => ({ displayStatus: 'COMPLETED', displayLabel: 'Completed' }),
  } as unknown as QuotationDisplayStatusResolver);

  it('returns contact and TIRA references from the list extras', () => {
    const item = mapper.toListItem(quotation({}), {
      customerName: 'Amani Juma',
      customerPhone: '0712345678',
      customerIdNumber: '1990-0101',
      vehicleRegistrationNumber: 'T123ABC',
      vehicleChassisNumber: null,
      stickerNo: 'ST-1',
      coverNoteNo: 'CN-1',
    });
    expect(item).toMatchObject({
      customer_name: 'Amani Juma',
      customer_phone: '0712345678',
      customer_id_number: '1990-0101',
      sticker_no: 'ST-1',
      cover_note_no: 'CN-1',
    });
  });

  it('only exposes the TIRA error while TIRA failed or rejected it', () => {
    expect(mapper.toListItem(quotation({}))).toMatchObject({
      tira_error_code: null,
      tira_error_reason: null,
    });
    for (const status of [TiraStatus.FAILED, TiraStatus.REJECTED]) {
      expect(
        mapper.toListItem(quotation({ tira_status: status })),
      ).toMatchObject({
        tira_error_code: 'E101',
        tira_error_reason: 'Vehicle already insured',
      });
    }
  });
});
