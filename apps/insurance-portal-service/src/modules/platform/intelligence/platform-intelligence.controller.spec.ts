import { Test, TestingModule } from '@nestjs/testing';
import { PlatformIntelligenceController } from './platform-intelligence.controller';
import { PlatformIntelligenceService } from './services/platform-intelligence.service';
import { PlatformIntelligencePermissions } from './platform-intelligence.permissions';

describe('PlatformIntelligenceController', () => {
  let controller: PlatformIntelligenceController;
  let intelligenceService: Partial<Record<keyof PlatformIntelligenceService, jest.Mock>>;

  beforeEach(async () => {
    intelligenceService = {
      listCompanyHealth: jest.fn().mockResolvedValue([{ id: 'health-1' }]),
      listBenchmarkSnapshots: jest.fn().mockResolvedValue([{ id: 'benchmark-1' }]),
      listAnomalyFindings: jest.fn().mockResolvedValue([{ id: 'finding-1' }]),
      listForecastRuns: jest.fn().mockResolvedValue([{ id: 'forecast-1' }]),
      rebuildBenchmarkSnapshots: jest.fn().mockResolvedValue({ message: 'ok' }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformIntelligenceController],
      providers: [
        {
          provide: PlatformIntelligenceService,
          useValue: intelligenceService,
        },
      ],
    }).compile();

    controller = module.get<PlatformIntelligenceController>(PlatformIntelligenceController);
  });

  it('lists company health', async () => {
    await expect(controller.listCompanyHealth()).resolves.toEqual([{ id: 'health-1' }]);
    expect(intelligenceService.listCompanyHealth).toHaveBeenCalled();
  });

  it('lists platform benchmark snapshots', async () => {
    const query = { metricCode: 'METRIC_1' };
    await expect(controller.listBenchmarks(query)).resolves.toEqual([{ id: 'benchmark-1' }]);
    expect(intelligenceService.listBenchmarkSnapshots).toHaveBeenCalledWith(query);
  });

  it('lists platform anomaly findings', async () => {
    const query = { companyId: 'company-id' };
    await expect(controller.listAnomalies(query)).resolves.toEqual([{ id: 'finding-1' }]);
    expect(intelligenceService.listAnomalyFindings).toHaveBeenCalledWith(query);
  });

  it('lists platform forecast runs', async () => {
    const query = { status: 'COMPLETED' };
    await expect(controller.listForecastRuns(query)).resolves.toEqual([{ id: 'forecast-1' }]);
    expect(intelligenceService.listForecastRuns).toHaveBeenCalledWith(query);
  });

  it('rebuilds benchmark snapshots', async () => {
    await expect(controller.rebuildBenchmarks()).resolves.toEqual({ message: 'ok' });
    expect(intelligenceService.rebuildBenchmarkSnapshots).toHaveBeenCalled();
  });
});
