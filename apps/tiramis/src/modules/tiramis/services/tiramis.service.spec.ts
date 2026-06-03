import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { TiramisItemEntity } from '../entities/tiramis-item.entity';
import { TiramisService } from './tiramis.service';

describe('TiramisService', () => {
  let service: TiramisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TiramisService,
        {
          provide: getRepositoryToken(TiramisItemEntity),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TiramisService>(TiramisService);
  });

  it('returns the service status', () => {
    expect(service.getStatus()).toEqual({
      status: 'ok',
      service: 'tiramis',
    });
  });
});
