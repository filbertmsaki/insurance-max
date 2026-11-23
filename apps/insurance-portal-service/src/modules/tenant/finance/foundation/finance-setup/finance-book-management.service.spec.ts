import { ForbiddenException, ConflictException } from '@nestjs/common';
import { FinanceBookManagementService } from './finance-book-management.service';

describe('Finance book management authority', () => {
  const scope = { legalEntityId: 'entity', bookId: 'book' };
  const admin = {
    id: 'user',
    companyId: 'company',
    scope: 'company',
    userType: 'COMPANY_ADMIN',
    roles: [],
  } as any;
  let query: jest.Mock;
  let service: FinanceBookManagementService;
  beforeEach(() => {
    query = jest.fn();
    service = new FinanceBookManagementService(
      { transaction: (fn: any) => fn({ query }) } as any,
      { logCritical: jest.fn() } as any,
    );
  });
  it('rejects non-administrators before querying a book', async () => {
    await expect(
      service.create({ ...admin, userType: 'COMPANY_USER' }, scope, 'NEW'),
    ).rejects.toThrow(ForbiddenException);
    expect(query).not.toHaveBeenCalled();
  });
  it('rejects an administrator without a current scoped release mandate', async () => {
    query.mockResolvedValue([]);
    await expect(service.create(admin, scope, 'NEW')).rejects.toThrow(
      ForbiddenException,
    );
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('does not delete a non-draft book', async () => {
    query
      .mockResolvedValueOnce([
        { tenant_id: 'tenant', legal_entity_id: 'entity' },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'book', state: 'ACTIVE' }]);
    await expect(service.remove(admin, scope)).rejects.toThrow(
      ConflictException,
    );
    expect(query).toHaveBeenCalledTimes(3);
  });
  it('rejects invalid book codes before database access', async () => {
    await expect(service.create(admin, scope, '../bad')).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
});
