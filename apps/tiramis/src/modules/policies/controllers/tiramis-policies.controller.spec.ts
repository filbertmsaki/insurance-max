import { TiramisReinsuranceController } from '../../reinsurance/controllers/tiramis-reinsurance.controller';
import type { CreateReinsuranceDto } from '../../reinsurance/dto/create-reinsurance.dto';
import type { TiramisReinsuranceService } from '../../reinsurance/services/tiramis-reinsurance.service';
import type { CreatePolicyDto } from '../dto/create-policy.dto';
import type { TiramisPolicyService } from '../services/tiramis-policy.service';
import { TiramisPoliciesController } from './tiramis-policies.controller';

const metadata = {
  sourceService: 'insurance-portal-service',
  businessReference: 'POL-0001',
  portalWebhookUrl:
    'https://portal.example.com/api/v1/webhooks/tiramis/notifications',
};
const encodedMetadata = Buffer.from(JSON.stringify(metadata)).toString(
  'base64url',
);

describe('submit routes forward X-Tiramis-Source-Metadata', () => {
  it('passes the parsed metadata to the policy service', async () => {
    const service = { submit: jest.fn().mockResolvedValue({ ok: true }) };
    const controller = new TiramisPoliciesController(
      service as unknown as TiramisPolicyService,
    );
    const dto = {} as CreatePolicyDto;

    await controller.submit(dto, encodedMetadata);

    expect(service.submit).toHaveBeenCalledWith(dto, metadata);
  });

  it('passes the parsed metadata to the reinsurance service', async () => {
    const service = { submit: jest.fn().mockResolvedValue({ ok: true }) };
    const controller = new TiramisReinsuranceController(
      service as unknown as TiramisReinsuranceService,
    );
    const dto = {} as CreateReinsuranceDto;

    await controller.submit(dto, encodedMetadata);

    expect(service.submit).toHaveBeenCalledWith(dto, metadata);
  });
});
