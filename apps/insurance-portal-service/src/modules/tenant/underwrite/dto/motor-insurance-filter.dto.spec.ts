import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  MotorInsurancePolicyFilterDto,
  MotorInsuranceQuotationFilterDto,
} from './motor-insurance-filter.dto';

/** Same options as the global pipe in main.ts. */
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  stopAtFirstError: false,
  transformOptions: { enableImplicitConversion: true },
});

const validate = (metatype: new () => object, value: Record<string, unknown>) =>
  pipe.transform(value, { type: 'query', metatype });

describe('Motor Insurance list filters', () => {
  const browserQuery = {
    page: '1',
    limit: '10',
    sortBy: 'created_at',
    sortOrder: 'DESC',
  };

  it('accepts the quotation register query sent by the web app', async () => {
    await expect(
      validate(MotorInsuranceQuotationFilterDto, {
        ...browserQuery,
        type: 'fleet',
        status: 'DRAFT',
      }),
    ).resolves.toBeDefined();
  });

  it('accepts the policy register query sent by the web app', async () => {
    await expect(
      validate(MotorInsurancePolicyFilterDto, {
        ...browserQuery,
        type: 'single',
      }),
    ).resolves.toBeDefined();
  });

  it('rejects the server-only multi-line filters from a client', async () => {
    await expect(
      validate(MotorInsuranceQuotationFilterDto, {
        quotation_flows: ['MOTOR_FLEET'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      validate(MotorInsurancePolicyFilterDto, { business_lines: ['FLEET'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unknown type', async () => {
    await expect(
      validate(MotorInsuranceQuotationFilterDto, { type: 'marine' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
