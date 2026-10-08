import { ForbiddenException } from '@nestjs/common';
import { InsuranceCompanyPartnerAmendment } from './entities/insurance-company-partner-amendment.entity';
import { InsuranceCompanyPartnerEvent } from './entities/insurance-company-partner-event.entity';
import { InsuranceCompanyPartner } from './entities/insurance-company-partner.entity';
import { PartnerRelationshipStatus } from './enums/partner-relationship-status.enum';
import { InsurancePartnersService } from './insurance-partners.service';

describe('InsurancePartnersService agreement amendments', () => {
  const relationship = {
    id: 'relationship-1',
    insurer_company_id: 'insurer-1',
    intermediary_company_id: 'broker-1',
    status: PartnerRelationshipStatus.ACTIVE,
  };

  it('records a bilateral amendment proposal and lifecycle event', async () => {
    const amendment = { id: 'amendment-1' };
    const amendmentRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn().mockResolvedValue(amendment),
    };
    const eventRepository = { save: jest.fn() };
    const relationshipManagerRepository = {
      createQueryBuilder: jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(relationship),
      })),
    };
    const manager = {
      query: jest.fn(),
      getRepository: jest.fn((entity) => {
        if (entity === InsuranceCompanyPartner)
          return relationshipManagerRepository;
        if (entity === InsuranceCompanyPartnerAmendment)
          return amendmentRepository;
        if (entity === InsuranceCompanyPartnerEvent) return eventRepository;
        throw new Error('Unexpected repository');
      }),
    };
    const dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
      getRepository: jest.fn(),
    };
    const service = new InsurancePartnersService(
      { findOne: jest.fn().mockResolvedValue(relationship) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      dataSource as any,
    );

    await expect(
      service.proposeAmendment('relationship-1', 'broker-1', 'user-1', {
        commission_rate: 0.12,
        note: 'Renewal terms',
      }),
    ).resolves.toEqual(amendment);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['relationship-1'],
    );
    expect(amendmentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        relationship_id: 'relationship-1',
        proposed_by_company_id: 'broker-1',
        proposed_by_user_id: 'user-1',
        status: 'PENDING',
        proposed_terms: expect.objectContaining({
          commission_rate: expect.any(String),
        }),
      }),
    );
    expect(eventRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'AMENDMENT_PROPOSED' }),
    );
  });

  it('does not expose amendments to an organization outside either side of the agreement', async () => {
    const partnerRepository = {
      findOne: jest.fn().mockResolvedValue(relationship),
    };
    const dataSource = { transaction: jest.fn() };
    const service = new InsurancePartnersService(
      partnerRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      dataSource as any,
    );

    await expect(
      service.findAmendments('relationship-1', 'unrelated-company'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
