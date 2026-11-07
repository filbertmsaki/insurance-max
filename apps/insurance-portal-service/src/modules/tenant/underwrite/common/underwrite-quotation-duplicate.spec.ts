import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { UnderwriteLine } from '@insurance-max/contracts';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import type { AuditService } from '../../../shared/audit/audit.service';
import type { CategoryAccessService } from '../../category-access/category-access.service';
import type { ProductAccessService } from '../../product-access/product-access.service';
import type { SaveQuotationDraftDto } from '../../quotations/dto/quotation-draft.dto';
import type { Quotation } from '../../quotations/entities/quotation.entity';
import type { QuotationsService } from '../../quotations/quotations.service';
import type { InsuranceProduct } from '../../insurance-products/entities/insurance-product.entity';
import type { FleetRegisterService } from '../fleet/fleet-register.service';
import {
  UnderwriteQuotationCommandService,
  stripDuplicateIdentifiers,
} from './underwrite-quotation-command.service';

const user = {
  id: 'user-1',
  companyId: 'company-1',
  permissions: [],
} as unknown as AuthenticatedUser;

function build(stored: Partial<Quotation> | null) {
  const quotationsService = {
    findOneForUser: jest
      .fn()
      .mockResolvedValue({ id: 'src-1', quotation_no: 'Q-100' }),
    createDraft: jest
      .fn()
      .mockResolvedValue({ id: 'new-1', quotation_no: 'Q-200' }),
  };
  const repository = { findOne: jest.fn().mockResolvedValue(stored) };
  const audit = { logCritical: jest.fn().mockResolvedValue(undefined) };
  const access = {
    resolveAccess: jest.fn().mockResolvedValue({ can_create_policy: true }),
  };
  const service = new UnderwriteQuotationCommandService(
    quotationsService as unknown as QuotationsService,
    access as unknown as CategoryAccessService,
    access as unknown as ProductAccessService,
    repository as unknown as Repository<Quotation>,
    {
      findOne: jest.fn().mockResolvedValue({ category_id: 'cat-1' }),
    } as unknown as Repository<InsuranceProduct>,
    {} as FleetRegisterService,
    audit as unknown as AuditService,
  );
  return { service, quotationsService, audit };
}

const dto = {
  quotation_flow: 'MOTOR_FLEET',
  category_id: 'cat-1',
  product_id: 'prod-1',
  draft_payload: {
    status: 'COMPLETED',
    customer_id: 'cust-1',
    fleet: {
      header: { fleet_id: 'FLT-1', fleet_type: '1' },
      items: [
        {
          cover_note_number: 'CN-1',
          motor_dtl: { registration_number: 'T123ABC' },
          risks_covered: [{ risk_code: 'R1', pricing_quote_id: 'pq-1' }],
        },
      ],
    },
  },
} as unknown as SaveQuotationDraftDto;

describe('Duplicate quotation (D2)', () => {
  it('strips identifiers but keeps the business data', () => {
    const result = stripDuplicateIdentifiers(dto.draft_payload) as any;

    expect(result.status).toBeUndefined();
    expect(result.fleet.header.fleet_id).toBeUndefined();
    expect(result.fleet.header.fleet_type).toBe('1');
    expect(result.fleet.items[0].cover_note_number).toBeUndefined();
    expect(
      result.fleet.items[0].risks_covered[0].pricing_quote_id,
    ).toBeUndefined();
    expect(result.fleet.items[0].risks_covered[0].risk_code).toBe('R1');
    expect(result.fleet.items[0].motor_dtl.registration_number).toBe('T123ABC');
    expect(result.customer_id).toBe('cust-1');
  });

  it('creates a new draft from a readable source in the same line and audits it', async () => {
    const { service, quotationsService, audit } = build({
      id: 'src-1',
      quotation_flow: 'MOTOR_FLEET',
      source_policy_transaction_id: null,
    } as Partial<Quotation>);

    const created = await service.duplicate(
      user,
      UnderwriteLine.FLEET,
      'src-1',
      dto,
    );

    expect(created).toEqual({ id: 'new-1', quotation_no: 'Q-200' });
    expect(quotationsService.findOneForUser).toHaveBeenCalledWith(
      user,
      'src-1',
    );
    const draftArg = quotationsService.createDraft.mock.calls[0][1];
    expect(draftArg.draft_payload.fleet.header.fleet_id).toBeUndefined();
    expect(audit.logCritical).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'quotation.duplicated',
        resourceId: 'new-1',
        beforeState: expect.objectContaining({ source_quotation_id: 'src-1' }),
      }),
    );
  });

  it('hides a source from another line', async () => {
    const { service, quotationsService } = build({
      id: 'src-1',
      quotation_flow: 'MOTOR_SINGLE',
    } as Partial<Quotation>);

    await expect(
      service.duplicate(user, UnderwriteLine.FLEET, 'src-1', dto),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(quotationsService.createDraft).not.toHaveBeenCalled();
  });

  it('does not duplicate a source the user cannot read', async () => {
    const { service, quotationsService } = build(null);
    quotationsService.findOneForUser.mockRejectedValue(
      new NotFoundException('Quotation not found'),
    );

    await expect(
      service.duplicate(user, UnderwriteLine.FLEET, 'src-1', dto),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(quotationsService.createDraft).not.toHaveBeenCalled();
  });

  it('refuses policy-transaction quotations', async () => {
    const { service, quotationsService } = build({
      id: 'src-1',
      quotation_flow: 'MOTOR_FLEET',
      source_policy_transaction_id: 'txn-1',
    } as Partial<Quotation>);

    await expect(
      service.duplicate(user, UnderwriteLine.FLEET, 'src-1', dto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(quotationsService.createDraft).not.toHaveBeenCalled();
  });
});
