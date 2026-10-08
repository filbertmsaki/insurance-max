import { ForbiddenException } from '@nestjs/common';
import { InsurancePartnersService } from './insurance-partners.service';
import { PartnerOperation } from './enums/partner-operation.enum';
import { PartnerRelationshipStatus } from './enums/partner-relationship-status.enum';
import { PartnerType } from './enums/partner-type.enum';

describe('InsurancePartnersService relationship authorization', () => {
  const insurerId = 'insurer-1';
  const partnerId = 'broker-1';
  const productId = 'product-1';
  const branchId = 'branch-1';
  let partnerRepository: { findOne: jest.Mock };
  let scopeRepository: { findOne: jest.Mock };
  let branchRepository: { findOne: jest.Mock };
  let service: InsurancePartnersService;

  beforeEach(() => {
    partnerRepository = { findOne: jest.fn() };
    scopeRepository = { findOne: jest.fn() };
    branchRepository = {
      findOne: jest.fn().mockResolvedValue({ id: branchId }),
    };
    service = new InsurancePartnersService(
      partnerRepository as any,
      scopeRepository as any,
      {} as any,
      {} as any,
      branchRepository as any,
      {} as any,
    );
  });

  it('allows only an active relationship with a granted product action and branch', async () => {
    partnerRepository.findOne.mockResolvedValue({
      id: 'relationship-1',
      status: PartnerRelationshipStatus.ACTIVE,
      scope_mode: 'RESTRICTED',
    });
    scopeRepository.findOne.mockResolvedValue({
      allowed_operations: [PartnerOperation.QUOTE],
      branch_ids: [branchId],
    });

    await expect(
      service.authorizeOperation(
        insurerId,
        partnerId,
        productId,
        PartnerOperation.QUOTE,
        branchId,
      ),
    ).resolves.toMatchObject({ legacy: false });
    expect(partnerRepository.findOne).toHaveBeenCalledWith({
      where: {
        insurer_company_id: insurerId,
        intermediary_company_id: partnerId,
        status: PartnerRelationshipStatus.ACTIVE,
      },
    });
  });

  it('rejects an unlinked partner before looking up product scopes', async () => {
    partnerRepository.findOne.mockResolvedValue(null);

    await expect(
      service.authorizeOperation(
        insurerId,
        partnerId,
        productId,
        PartnerOperation.QUOTE,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(scopeRepository.findOne).not.toHaveBeenCalled();
  });

  it('rejects a linked partner when the requested action is not granted', async () => {
    partnerRepository.findOne.mockResolvedValue({
      id: 'relationship-1',
      status: PartnerRelationshipStatus.ACTIVE,
      scope_mode: 'RESTRICTED',
    });
    scopeRepository.findOne.mockResolvedValue({
      allowed_operations: [PartnerOperation.VIEW_POLICY],
    });

    await expect(
      service.authorizeOperation(
        insurerId,
        partnerId,
        productId,
        PartnerOperation.QUOTE,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects access through an ungranted insurer branch', async () => {
    partnerRepository.findOne.mockResolvedValue({
      id: 'relationship-1',
      status: PartnerRelationshipStatus.ACTIVE,
      scope_mode: 'RESTRICTED',
    });
    scopeRepository.findOne.mockResolvedValue({
      allowed_operations: [PartnerOperation.QUOTE],
      branch_ids: ['another-branch'],
    });

    await expect(
      service.authorizeOperation(
        insurerId,
        partnerId,
        productId,
        PartnerOperation.QUOTE,
        branchId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('matches reinsurance links by the specified partner type and effective status', async () => {
    partnerRepository.findOne.mockResolvedValue({
      id: 'relationship-2',
      status: PartnerRelationshipStatus.ACTIVE,
      start_date: null,
      end_date: null,
    });

    await expect(
      service.findActiveCompanyRelationship(
        insurerId,
        'reinsurer-1',
        PartnerType.REINSURANCE_COMPANY,
      ),
    ).resolves.toMatchObject({ id: 'relationship-2' });
    expect(partnerRepository.findOne).toHaveBeenCalledWith({
      where: {
        insurer_company_id: insurerId,
        intermediary_company_id: 'reinsurer-1',
        partner_type: PartnerType.REINSURANCE_COMPANY,
        status: PartnerRelationshipStatus.ACTIVE,
      },
    });
  });
});
