import { ProductPerformanceReportGenerator } from './product-performance-report.generator';

describe('ProductPerformanceReportGenerator branch scope', () => {
  const query = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };
  const generator = new ProductPerformanceReportGenerator({
    createQueryBuilder: () => query,
  } as any);
  beforeEach(() => jest.clearAllMocks());
  it('intersects a requested branch with the allowed branch list', async () => {
    await generator.generate({
      companyId: 'company',
      branchId: 'allowed',
      allowedBranchIds: ['allowed'],
      parameters: { branch_id: 'other' },
      definition: {},
    } as any);
    expect(query.andWhere).toHaveBeenCalledWith(
      'snapshot.branch_id = :branchId',
      { branchId: 'other' },
    );
    expect(query.andWhere).toHaveBeenCalledWith(
      'snapshot.branch_id IN (:...allowedBranchIds)',
      { allowedBranchIds: ['allowed'] },
    );
  });
  it('returns no data for an empty branch scope even with a requested branch', async () => {
    await generator.generate({
      companyId: 'company',
      allowedBranchIds: [],
      parameters: { branch_id: 'other' },
      definition: {},
    } as any);
    expect(query.andWhere).toHaveBeenCalledWith('1 = 0');
  });
});
