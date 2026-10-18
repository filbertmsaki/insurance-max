import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

/** Exercise the actual HTTP router and pipes; service calls alone miss route shadowing. */
describe('Customer search HTTP routing', () => {
  let app: INestApplication;
  const user = {
    id: 'a4f80152-7992-41c2-bb41-4864965bd6f5',
    companyId: '574079ff-95a1-4e0a-bbee-a8c136c531de',
  };
  const customerId = '4d613bf0-8915-410b-9a4f-f53bb50ba3b1';
  const service = {
    searchForUser: jest.fn().mockResolvedValue({
      data: [],
      meta: {
        page: 1,
        limit: 20,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    }),
    findOneForUser: jest.fn().mockResolvedValue({ id: customerId }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [{ provide: CustomersService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    app.use((req: { user?: typeof user }, _res: unknown, next: () => void) => {
      req.user = user;
      next();
    });
    await app.init();
  });
  afterEach(() => jest.clearAllMocks());
  afterAll(async () => {
    await app?.close();
  });

  it('routes the reported /search?q=fil&limit=20 request to search without parsing a UUID', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/tenant/customers/search?q=fil&limit=20')
      .expect(200);
    expect(response.body.data).toEqual([]);
    expect(service.searchForUser).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ q: 'fil', limit: 20, page: 1 }),
    );
    expect(service.findOneForUser).not.toHaveBeenCalled();
  });

  it('keeps UUID detail requests routed to the detail handler', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tenant/customers/${customerId}`)
      .expect(200);
    expect(service.findOneForUser).toHaveBeenCalledWith(user, customerId);
    expect(service.searchForUser).not.toHaveBeenCalled();
  });

  it('retains UUID validation for invalid customer detail IDs', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/tenant/customers/not-a-uuid')
      .expect(400);
    expect(response.body.message).toBe('Validation failed (uuid is expected)');
    expect(service.findOneForUser).not.toHaveBeenCalled();
  });

  it('validates search pagination without treating the search term as a UUID', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/tenant/customers/search?q=fil&limit=invalid')
      .expect(400);
    expect(response.body.message.join(' ')).toContain('limit');
    expect(response.body.message.join(' ')).not.toContain('uuid');
    expect(service.searchForUser).not.toHaveBeenCalled();
  });
});
