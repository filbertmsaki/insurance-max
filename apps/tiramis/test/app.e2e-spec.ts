import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { TiramisController } from '../src/modules/tiramis/controllers/tiramis.controller';
import { TiramisService } from '../src/modules/tiramis/services/tiramis.service';

describe('Tiramis Controller (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TiramisController],
      providers: [
        {
          provide: TiramisService,
          useValue: {
            getStatus: jest.fn().mockReturnValue({
              status: 'ok',
              service: 'tiramis',
            }),
            findAll: jest.fn().mockResolvedValue([]),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/tiramis/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/tiramis/health')
      .expect(200)
      .expect({
        status: 'ok',
        service: 'tiramis',
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
