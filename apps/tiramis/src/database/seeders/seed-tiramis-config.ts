import 'reflect-metadata';

import dataSource from '../data-source';

import { TiramisClientConfigurationEntity } from '../../modules/config/entities/tiramis-client-configuration.entity';
import { TiramisResponseCodeEntity } from '../../modules/config/entities/tiramis-response-code.entity';
import { TiramisServiceEndpointEntity } from '../../modules/config/entities/tiramis-service-endpoint.entity';

type EnvironmentName = 'live' | 'test';

type ConfigurationSeed = {
  environment: EnvironmentName;
  companyCode: string;
  systemCode: string;
  clientCode: string;
  clientKey: string;
  privateKeyPfxPassword: string;
  publicCertificatePfxPassword: string;
  insurerCompanyCode: string;
  salePointCode: string;
  tranCompanyCode: string;
  baseUrl: string;
  callbackBaseUrl: string;
  privateKeyPfxPath?: string | null;
  publicCertificatePfxPath?: string | null;
  tiraPublicCertificatePfxPath?: string | null;
  tiraPublicCertificatePfxPassword?: string | null;
  signatureAlgorithm: string;
};

const configurations: ConfigurationSeed[] = [
  {
    environment: 'live',
    companyCode: 'ICC110',
    systemCode: 'LSYS_ALLIANCE_003',
    clientCode: 'ICC110',
    clientKey: 'RydLDE8CFJ',
    privateKeyPfxPassword: 'Alli@ncTir@2025!',
    publicCertificatePfxPassword: 'TiraClient@2021',
    insurerCompanyCode: 'ICC110',
    salePointCode: 'SP500',
    tranCompanyCode: 'ICC110',
    baseUrl: 'https://api.tira.go.tz:8091',
    callbackBaseUrl: 'https://ussdvd.alliance.co.tz/api/v1/tira-callback',
    privateKeyPfxPath: process.env.TIRAMIS_LIVE_PRIVATE_PFX_PATH || null,
    publicCertificatePfxPath:
      process.env.TIRAMIS_LIVE_PUBLIC_PFX_PATH || null,
    tiraPublicCertificatePfxPath:
      process.env.TIRAMIS_LIVE_TIRA_PUBLIC_PFX_PATH || null,
    tiraPublicCertificatePfxPassword:
      process.env.TIRAMIS_LIVE_TIRA_PUBLIC_PFX_PASSWORD || null,
    signatureAlgorithm: 'sha1WithRSAEncryption',
  },
  {
    environment: 'test',
    companyCode: 'ICC110',
    systemCode: 'LSYS_ALLIANCE_003',
    clientCode: 'ICC110',
    clientKey: 'RydLDE8CFJ',
    privateKeyPfxPassword: 'Alli@ncTir@2025!',
    publicCertificatePfxPassword: 'TiraClient@2021',
    insurerCompanyCode: 'ICC110',
    salePointCode: 'SP500',
    tranCompanyCode: 'ICC110',
    baseUrl: 'http://41.59.86.178:8091',
    callbackBaseUrl:
      process.env.TIRAMIS_TEST_CALLBACK_URL ||
      'http://localhost:3000/api/tiramis/callbacks/test',
    privateKeyPfxPath: process.env.TIRAMIS_TEST_PRIVATE_PFX_PATH || null,
    publicCertificatePfxPath:
      process.env.TIRAMIS_TEST_PUBLIC_PFX_PATH || null,
    tiraPublicCertificatePfxPath:
      process.env.TIRAMIS_TEST_TIRA_PUBLIC_PFX_PATH || null,
    tiraPublicCertificatePfxPassword:
      process.env.TIRAMIS_TEST_TIRA_PUBLIC_PFX_PASSWORD || null,
    signatureAlgorithm: 'sha1WithRSAEncryption',
  },
];

const endpointSeeds = [
  {
    serviceType: 'COVER_NOTE_NON_MOTOR',
    endpointUrl: '/ecovernote/api/covernote/non-life/other/v2/request',
  },
  {
    serviceType: 'MOTOR_COVER_NOTE_NON_FLEET',
    endpointUrl: '/ecovernote/api/covernote/non-life/motor/v2/request',
  },
  {
    serviceType: 'MOTOR_COVER_NOTE_FLEET',
    endpointUrl: '/ecovernote/api/covernote/non-life/motor-fleet/v2/request',
  },
  {
    serviceType: 'REINSURANCE',
    endpointUrl: '/ecovernote/api/reinsurance/v1/request',
  },
  {
    serviceType: 'POLICY',
    endpointUrl: '/ecovernote/api/policy/v1/request',
  },
  {
    serviceType: 'CLAIM_NOTIFICATION',
    endpointUrl: '/eclaim/api/claim/claim-notification/v1/request',
  },
  {
    serviceType: 'CLAIM_INTIMATION',
    endpointUrl: '/eclaim/api/claim/claim-intimation/v1/request',
  },
  {
    serviceType: 'CLAIM_ASSESSMENT',
    endpointUrl: '/eclaim/api/claim/claim-assessment/v1/request',
  },
  {
    serviceType: 'DISCHARGE_VOUCHER',
    endpointUrl: '/eclaim/api/claim/claim-dischargevoucher/v1/request',
  },
  {
    serviceType: 'CLAIM_PAYMENT',
    endpointUrl: '/eclaim/api/claim/claim-payment/v1/request',
  },
  {
    serviceType: 'CLAIM_REJECTION',
    endpointUrl: '/eclaim/api/claim/claim-rejection/v1/request',
  },
  {
    serviceType: 'COVER_NOTE_VERIFICATION',
    endpointUrl: '/ecovernote/api/covernote/verification/min/v1/request',
  },
  {
    serviceType: 'MOTOR_VERIFICATION',
    endpointUrl: '/dispatch/api/motor/verification/v3/request',
  },
];

const responseCodeSeeds = [
  {
    code: 'TIRA001',
    description: 'Successful',
    category: 'SUCCESS',
    isSuccess: 1,
    isRetryable: 0,
  },
  {
    code: 'TIRA002',
    description: 'Failed',
    category: 'FAILURE',
    isSuccess: 0,
    isRetryable: 0,
  },
  {
    code: 'TIRA005',
    description: 'Invalid Request Data',
    category: 'VALIDATION',
    isSuccess: 0,
    isRetryable: 0,
  },
];

async function seedClientConfigurations() {
  const configurationRepository = dataSource.getRepository(
    TiramisClientConfigurationEntity,
  );
  const endpointRepository = dataSource.getRepository(
    TiramisServiceEndpointEntity,
  );

  for (const configurationSeed of configurations) {
    let configuration = await configurationRepository.findOne({
      where: {
        environment: configurationSeed.environment,
        companyCode: configurationSeed.companyCode,
        systemCode: configurationSeed.systemCode,
      },
    });

    if (!configuration) {
      configuration = configurationRepository.create();
    }

    configuration.environment = configurationSeed.environment;
    configuration.companyCode = configurationSeed.companyCode;
    configuration.systemCode = configurationSeed.systemCode;
    configuration.clientCode = configurationSeed.clientCode;
    configuration.clientKey = configurationSeed.clientKey;
    configuration.insurerCompanyCode = configurationSeed.insurerCompanyCode;
    configuration.salePointCode = configurationSeed.salePointCode;
    configuration.tranCompanyCode = configurationSeed.tranCompanyCode;
    configuration.baseUrl = configurationSeed.baseUrl;
    configuration.callbackBaseUrl = configurationSeed.callbackBaseUrl;
    configuration.privateKeyPfxPath = configurationSeed.privateKeyPfxPath;
    configuration.privateKeyPfxPassword =
      configurationSeed.privateKeyPfxPassword;
    configuration.publicCertificatePfxPath =
      configurationSeed.publicCertificatePfxPath;
    configuration.publicCertificatePfxPassword =
      configurationSeed.publicCertificatePfxPassword;
    configuration.tiraPublicCertificatePfxPath =
      configurationSeed.tiraPublicCertificatePfxPath;
    configuration.tiraPublicCertificatePfxPassword =
      configurationSeed.tiraPublicCertificatePfxPassword;
    configuration.signatureAlgorithm = configurationSeed.signatureAlgorithm;
    configuration.isActive = 1;

    const savedConfiguration =
      await configurationRepository.save(configuration);

    for (const endpointSeed of endpointSeeds) {
      let endpoint = await endpointRepository.findOne({
        where: {
          clientConfigurationId: savedConfiguration.id,
          serviceType: endpointSeed.serviceType,
        },
      });

      if (!endpoint) {
        endpoint = endpointRepository.create();
      }

      endpoint.clientConfigurationId = savedConfiguration.id;
      endpoint.serviceType = endpointSeed.serviceType;
      endpoint.endpointUrl = endpointSeed.endpointUrl;
      endpoint.httpMethod = 'POST';
      endpoint.contentType = 'application/xml';
      endpoint.isActive = 1;

      await endpointRepository.save(endpoint);
    }
  }
}

async function seedResponseCodes() {
  const responseCodeRepository = dataSource.getRepository(
    TiramisResponseCodeEntity,
  );

  for (const responseCodeSeed of responseCodeSeeds) {
    let responseCode = await responseCodeRepository.findOne({
      where: { code: responseCodeSeed.code },
    });

    if (!responseCode) {
      responseCode = responseCodeRepository.create();
    }

    responseCode.code = responseCodeSeed.code;
    responseCode.description = responseCodeSeed.description;
    responseCode.category = responseCodeSeed.category;
    responseCode.isSuccess = responseCodeSeed.isSuccess;
    responseCode.isRetryable = responseCodeSeed.isRetryable;
    responseCode.isActive = 1;

    await responseCodeRepository.save(responseCode);
  }
}

async function main() {
  await dataSource.initialize();

  try {
    await seedClientConfigurations();
    await seedResponseCodes();

    console.log(
      'Seeded Tiramis client configurations, service endpoints, and response codes.',
    );
    console.log(
      'Note: NIN_VERIFICATION, COMPANY_VERIFICATION, and DETAILS_VERIFICATION endpoints were not seeded because they were not present in the provided TIRA endpoint documents.',
    );
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error) => {
  console.error('Failed to seed Tiramis configuration:', error);
  process.exit(1);
});
