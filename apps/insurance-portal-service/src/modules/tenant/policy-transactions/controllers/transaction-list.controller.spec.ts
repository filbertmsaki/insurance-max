import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  EndorsementListQueryDto,
  RenewalListQueryDto,
} from '../dto/transaction-list-query.dto';
import { EndorsementsController } from './endorsements.controller';
import { RenewalsController } from './renewals.controller';

const user = { id: 'user-1', companyId: 'company-1' } as AuthenticatedUser;
const policyId = '6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6';

async function errorsFor<T extends object>(cls: new () => T, raw: object) {
  return (await validate(plainToInstance(cls, raw))).map((e) => e.property);
}

describe('company-wide transaction lists', () => {
  describe('EndorsementsController.findAll', () => {
    const service = {
      findAll: jest.fn().mockResolvedValue([{ id: 'e1' }]),
      findPage: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
    };
    const controller = new EndorsementsController(
      service as never,
      {} as never,
      {} as never,
      {} as never,
    );

    beforeEach(() => jest.clearAllMocks());

    it('keeps the legacy array response when no page is requested', async () => {
      await expect(
        controller.findAll(user, { policy_id: policyId }),
      ).resolves.toEqual([{ id: 'e1' }]);
      expect(service.findAll).toHaveBeenCalledWith(user, policyId);
      expect(service.findPage).not.toHaveBeenCalled();
    });

    it('uses the paged table contract when page is sent', async () => {
      const query = {
        page: 2,
        limit: 20,
        search: 'END',
        stage: 'DRAFT',
      } as const;
      await controller.findAll(user, query);
      expect(service.findPage).toHaveBeenCalledWith(user, query);
      expect(service.findAll).not.toHaveBeenCalled();
    });
  });

  describe('RenewalsController.findAll', () => {
    const service = {
      findAll: jest.fn().mockResolvedValue([]),
      findPage: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
    };
    const controller = new RenewalsController(service as never);

    beforeEach(() => jest.clearAllMocks());

    it('scopes the legacy list to the caller company', async () => {
      await controller.findAll(user, {});
      expect(service.findAll).toHaveBeenCalledWith(
        'company-1',
        undefined,
        user,
      );
    });

    it('uses the paged table contract when page is sent', async () => {
      await controller.findAll(user, { page: 1 });
      expect(service.findPage).toHaveBeenCalledWith(user, { page: 1 });
    });
  });

  describe('query validation', () => {
    it('rejects page sizes above the table maximum and non-positive pages', async () => {
      expect(
        await errorsFor(EndorsementListQueryDto, { page: '0', limit: '500' }),
      ).toEqual(expect.arrayContaining(['page', 'limit']));
    });

    it('rejects unknown status filters and non-UUID policy ids', async () => {
      expect(
        await errorsFor(EndorsementListQueryDto, {
          stage: 'NOT_A_STAGE',
          policy_id: 'x',
        }),
      ).toEqual(expect.arrayContaining(['stage', 'policy_id']));
      expect(
        await errorsFor(RenewalListQueryDto, { renewal_status: 'BOGUS' }),
      ).toEqual(['renewal_status']);
    });

    it('rejects sort keys that are not plain identifiers', async () => {
      expect(
        await errorsFor(RenewalListQueryDto, {
          sortBy: 'created_at; DROP TABLE renewals',
        }),
      ).toEqual(['sortBy']);
    });

    it('accepts a valid combined request', async () => {
      expect(
        await errorsFor(RenewalListQueryDto, {
          page: '3',
          limit: '50',
          search: 'REN-001',
          sortBy: 'renewal_no',
          sortOrder: 'asc',
          renewal_status: 'OFFER_SENT',
          policy_id: policyId,
        }),
      ).toEqual([]);
    });
  });
});
