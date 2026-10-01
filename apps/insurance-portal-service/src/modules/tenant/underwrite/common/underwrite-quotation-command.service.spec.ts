import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import { UnderwriteLine } from '@insurance-max/contracts';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import type { CategoryAccessService } from '../../category-access/category-access.service';
import type { ProductAccessService } from '../../product-access/product-access.service';
import type {
  SaveQuotationDraftDto,
  UpdateQuotationDraftDto,
} from '../../quotations/dto/quotation-draft.dto';
import type { UpdateQuotationDto } from '../../quotations/dto/quotation-payload.dto';
import type { Quotation } from '../../quotations/entities/quotation.entity';
import type { QuotationsService } from '../../quotations/quotations.service';
import type { InsuranceProduct } from '../../insurance-products/entities/insurance-product.entity';
import type { FleetRegisterService } from '../fleet/fleet-register.service';
import type { NonMotorRiskService } from '../non-motor/non-motor-risk.service';
import { UnderwriteQuotationCommandService } from './underwrite-quotation-command.service';

const user = {
  id: 'user-1',
  companyId: 'company-1',
  companyMembershipId: 'membership-1',
  permissions: [],
} as unknown as AuthenticatedUser;

function build(
  options: {
    storedFlow?: string;
    canCreate?: boolean;
    syncFails?: boolean;
    riskIncomplete?: boolean;
  } = {},
) {
  const quotationsService = {
    createDraft: jest.fn().mockResolvedValue({ id: 'q-1' }),
    updateDraft: jest.fn().mockResolvedValue({ id: 'q-1' }),
    finalize: jest.fn().mockResolvedValue({ id: 'q-1' }),
    removeDraftForUser: jest.fn().mockResolvedValue(undefined),
    findOneForEditForUser: jest.fn().mockResolvedValue({ id: 'q-1' }),
  };
  const access = {
    resolveAccess: jest
      .fn()
      .mockResolvedValue({ can_create_policy: options.canCreate ?? true }),
  };
  const repository = {
    findOne: jest
      .fn()
      .mockResolvedValue(
        options.storedFlow === undefined
          ? null
          : { id: 'q-1', quotation_flow: options.storedFlow },
      ),
  };
  const insuranceProductRepository = {
    findOne: jest.fn().mockResolvedValue({ category_id: 'cat-1' }),
  };

  const fleetRegister = {
    syncFromQuotation: options.syncFails
      ? jest.fn().mockRejectedValue(new Error('register unavailable'))
      : jest.fn().mockResolvedValue({ fleetId: 'fleet-1' }),
  };

  const nonMotorRisk = {
    assertDocumentsCompleteForFinalize: jest.fn().mockResolvedValue(undefined),
    assertCompleteForFinalize: options.riskIncomplete
      ? jest.fn().mockRejectedValue(new BadRequestException('incomplete'))
      : jest.fn().mockResolvedValue(undefined),
  };

  const service = new UnderwriteQuotationCommandService(
    quotationsService as unknown as QuotationsService,
    access as unknown as CategoryAccessService,
    access as unknown as ProductAccessService,
    repository as unknown as Repository<Quotation>,
    insuranceProductRepository as unknown as Repository<InsuranceProduct>,
    fleetRegister as unknown as FleetRegisterService,
    nonMotorRisk as unknown as NonMotorRiskService,
  );

  return { service, quotationsService, fleetRegister, nonMotorRisk };
}

const fleetPayload = {
  internal_quotation: {
    quotation_flow: 'MOTOR_FLEET',
    category_id: 'cat-1',
    product_id: 'prod-1',
  },
} as unknown as UpdateQuotationDto;

const draft = (flow: string) =>
  ({
    quotation_flow: flow,
    category_id: 'cat-1',
    product_id: 'prod-1',
  }) as unknown as SaveQuotationDraftDto;

describe('UnderwriteQuotationCommandService', () => {
  it('creates a draft through the existing service when the flow matches the line', async () => {
    const { service, quotationsService } = build();

    await service.createDraft(
      user,
      UnderwriteLine.MOTOR,
      draft('MOTOR_SINGLE'),
    );

    expect(quotationsService.createDraft).toHaveBeenCalledWith(
      'company-1',
      expect.objectContaining({ quotation_flow: 'MOTOR_SINGLE' }),
      user,
    );
  });

  it('rejects a draft whose flow belongs to another line', async () => {
    const { service, quotationsService } = build();

    await expect(
      service.createDraft(user, UnderwriteLine.MOTOR, draft('MOTOR_FLEET')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(quotationsService.createDraft).not.toHaveBeenCalled();
  });

  it('enforces product access like the legacy controller', async () => {
    const { service } = build({ canCreate: false });

    await expect(
      service.createDraft(user, UnderwriteLine.MOTOR, draft('MOTOR_SINGLE')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('hides quotations stored in another line behind a 404', async () => {
    const { service, quotationsService } = build({ storedFlow: 'NON_MOTOR' });

    await expect(
      service.updateDraft(
        user,
        UnderwriteLine.MOTOR,
        'q-1',
        draft('MOTOR_SINGLE') as UpdateQuotationDraftDto,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.removeDraft(user, UnderwriteLine.MOTOR, 'q-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(quotationsService.updateDraft).not.toHaveBeenCalled();
    expect(quotationsService.removeDraftForUser).not.toHaveBeenCalled();
  });

  it('finalizes a quotation of the same line', async () => {
    const { service, quotationsService } = build({
      storedFlow: 'MOTOR_SINGLE',
    });
    const payload = {
      internal_quotation: {
        quotation_flow: 'MOTOR_SINGLE',
        category_id: 'cat-1',
        product_id: 'prod-1',
      },
    } as unknown as UpdateQuotationDto;

    await service.finalize(user, UnderwriteLine.MOTOR, 'q-1', payload);

    expect(quotationsService.finalize).toHaveBeenCalledWith(
      'company-1',
      'q-1',
      payload,
      user,
    );
  });

  it('projects a finalized fleet quotation into the fleet register', async () => {
    const { service, fleetRegister } = build({ storedFlow: 'MOTOR_FLEET' });

    await service.finalize(user, UnderwriteLine.FLEET, 'q-1', fleetPayload);

    expect(fleetRegister.syncFromQuotation).toHaveBeenCalledWith(
      'company-1',
      'q-1',
    );
  });

  it('keeps the completed quotation when the register sync fails', async () => {
    const { service } = build({ storedFlow: 'MOTOR_FLEET', syncFails: true });

    await expect(
      service.finalize(user, UnderwriteLine.FLEET, 'q-1', fleetPayload),
    ).resolves.toEqual({ id: 'q-1' });
  });

  it('does not touch the fleet register for motor quotations', async () => {
    const { service, fleetRegister } = build({ storedFlow: 'MOTOR_SINGLE' });

    await service.finalize(user, UnderwriteLine.MOTOR, 'q-1', {
      internal_quotation: {
        quotation_flow: 'MOTOR_SINGLE',
        category_id: 'cat-1',
        product_id: 'prod-1',
      },
    } as unknown as UpdateQuotationDto);

    expect(fleetRegister.syncFromQuotation).not.toHaveBeenCalled();
  });

  const nonMotorPayload = {
    internal_quotation: {
      quotation_flow: 'NON_MOTOR',
      category_id: 'cat-1',
      product_id: 'prod-1',
      sub_class_id: 'sub-1',
    },
  } as unknown as UpdateQuotationDto;

  it('checks non-motor risk details against the product schema before finalizing', async () => {
    const { service, nonMotorRisk, quotationsService } = build({
      storedFlow: 'NON_MOTOR',
    });

    await service.finalize(
      user,
      UnderwriteLine.NON_MOTOR,
      'q-1',
      nonMotorPayload,
    );

    expect(nonMotorRisk.assertCompleteForFinalize).toHaveBeenCalledWith(
      'company-1',
      'q-1',
      'prod-1',
      'sub-1',
    );
    expect(quotationsService.finalize).toHaveBeenCalled();
  });

  it('does not finalize a non-motor quotation with incomplete risk details', async () => {
    const { service, quotationsService } = build({
      storedFlow: 'NON_MOTOR',
      riskIncomplete: true,
    });

    await expect(
      service.finalize(user, UnderwriteLine.NON_MOTOR, 'q-1', nonMotorPayload),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(quotationsService.finalize).not.toHaveBeenCalled();
  });
});
