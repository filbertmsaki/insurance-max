import 'reflect-metadata';

import { createCipheriv, randomBytes } from 'crypto';
import { join } from 'path';

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
  clientPrivateCertificatePassword: string;
  tiraPublicCertificatePassword: string;
  insurerCompanyCode: string;
  salePointCode: string;
  tranCompanyCode: string;
  baseUrl: string;
  callbackBaseUrl: string;
  clientPrivateCertificatePath?: string | null;
  tiraPublicCertificatePath?: string | null;
  signatureAlgorithm: string;
};

const certificateRootPath = join(
  'apps',
  'tiramis',
  'src',
  'assets',
  'certificaties',
);

function getClientPrivateCertificatePath(environment: EnvironmentName): string {
  return join(certificateRootPath, environment, 'clientprivate.pfx');
}

function getTiraPublicCertificatePath(environment: EnvironmentName): string {
  return join(certificateRootPath, environment, 'tiramispublic.pfx');
}

function mustEnv(name: string): string {
  const value = process.env[name];

  if (!value?.trim()) {
    throw new Error(
      `[seed-env] Missing required environment variable: ${name}`,
    );
  }

  return value.trim();
}

function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value?.trim() ? value.trim() : fallback;
}

function encryptSecret(plainText: string): string {
  if (!plainText) {
    return plainText;
  }

  if (plainText.startsWith('enc:v1:')) {
    return plainText;
  }

  const rawKey = mustEnv('TIRAMIS_SECRET_ENCRYPTION_KEY');
  const key = Buffer.from(rawKey, 'base64');

  if (key.length !== 32) {
    throw new Error(
      'TIRAMIS_SECRET_ENCRYPTION_KEY must be a base64 encoded 32-byte key',
    );
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    'enc',
    'v1',
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

const configurations: ConfigurationSeed[] = [
  {
    environment: 'test',
    companyCode: 'ICC110',
    systemCode: 'LSYS_ALLIANCE_001',
    clientCode: 'ICC110',
    clientKey: mustEnv('ALLIANCE_TIRA_CLIENT_KEY_TEST'),
    clientPrivateCertificatePassword: mustEnv(
      'ALLIANCE_CLIENT_PRIVATE_CERT_PASSWORD_TEST',
    ),
    tiraPublicCertificatePassword: mustEnv('TIRA_PUBLIC_CERT_PASSWORD_TEST'),
    insurerCompanyCode: 'ICC110',
    salePointCode: 'SP500',
    tranCompanyCode: 'ICC110',
    baseUrl: optionalEnv('TIRAMIS_TEST_BASE_URL', 'http://localhost:5050'),
    callbackBaseUrl: mustEnv('TIRAMIS_TEST_CALLBACK_BASE_URL'),
    clientPrivateCertificatePath: getClientPrivateCertificatePath('test'),
    tiraPublicCertificatePath: getTiraPublicCertificatePath('test'),
    signatureAlgorithm: 'sha1WithRSAEncryption',
  },
  {
    environment: 'live',
    companyCode: 'ICC110',
    systemCode: 'LSYS_ALLIANCE_001',
    clientCode: 'ICC110',
    clientKey: mustEnv('ALLIANCE_TIRA_CLIENT_KEY_LIVE'),
    clientPrivateCertificatePassword: mustEnv(
      'ALLIANCE_CLIENT_PRIVATE_CERT_PASSWORD_LIVE',
    ),
    tiraPublicCertificatePassword: mustEnv('TIRA_PUBLIC_CERT_PASSWORD_LIVE'),
    insurerCompanyCode: 'ICC110',
    salePointCode: 'SP500',
    tranCompanyCode: 'ICC110',
    baseUrl: mustEnv('TIRAMIS_LIVE_BASE_URL'),
    callbackBaseUrl: mustEnv('TIRAMIS_LIVE_CALLBACK_BASE_URL'),
    clientPrivateCertificatePath: getClientPrivateCertificatePath('live'),
    tiraPublicCertificatePath: getTiraPublicCertificatePath('live'),
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
  {
    serviceType: 'NIN_VERIFICATION',
    endpointUrl: '/dispatch/api/nin/verification/v1/request',
  },
  {
    serviceType: 'COMPANY_VERIFICATION',
    endpointUrl: '/dispatch/api/company/verification/v1/request',
  },
  {
    serviceType: 'DETAILS_VERIFICATION',
    endpointUrl: '/dispatch/api/details/verification/v1/request',
  },
];

type ResponseCodeSeed = {
  code: string;
  description: string;
  category: string;
  isSuccess: number;
  isRetryable: number;
};

function inferResponseCodeCategory(description: string): string {
  const normalizedDescription = description.toLowerCase();

  if (normalizedDescription === 'successful') {
    return 'SUCCESS';
  }

  if (
    normalizedDescription.includes('try again later') ||
    normalizedDescription.includes('internal communication failure') ||
    normalizedDescription.includes('error occurred while connecting') ||
    normalizedDescription.includes('pending transaction waiting for processing')
  ) {
    return 'RETRYABLE';
  }

  if (normalizedDescription.includes('duplicate')) {
    return 'DUPLICATE';
  }

  if (normalizedDescription.includes('not found')) {
    return 'NOT_FOUND';
  }

  if (
    normalizedDescription.includes('invalid') ||
    normalizedDescription.includes('inactive') ||
    normalizedDescription.includes('required') ||
    normalizedDescription.includes('bad or missing') ||
    normalizedDescription.includes('mismatch')
  ) {
    return 'VALIDATION';
  }

  return 'FAILURE';
}

function inferRetryable(description: string): number {
  const normalizedDescription = description.toLowerCase();

  return normalizedDescription.includes('try again later') ||
    normalizedDescription.includes('internal communication failure') ||
    normalizedDescription.includes('error occurred while connecting') ||
    normalizedDescription.includes('pending transaction waiting for processing')
    ? 1
    : 0;
}

const responseCodeSeedEntries: Array<[string, string]> = [
  ['TIRA001', 'Successful'],
  ['TIRA002', 'Failure'],
  ['TIRA003', 'Invalid client key'],
  ['TIRA004', 'An occured while processing'],
  ['TIRA005', 'Invalid or incomplete request data'],
  ['TIRA006', 'Request could not be processed. Try again later'],
  ['TIRA007', 'Requested data could not be found'],
  ['TIRA008', 'Required request header information not provided'],
  [
    'TIRA009',
    'Request header information mismatch client identification parameters',
  ],
  ['TIRA010', 'Server internal communication failure'],
  ['TIRA011', 'Client system configuration not found'],
  ['TIRA012', 'Inactive or disabled Client system configuration'],
  ['TIRA013', 'Inactive or invalid Client'],
  ['TIRA014', 'Client PKI certificate file not found in specified path'],
  ['TIRA015', 'Bad or missing Client PKI configurations'],
  ['TIRA016', 'Invalid request signature'],
  ['TIRA017', 'Invalid client system call back url'],
  ['TIRA018', 'Invalid company code'],
  ['TIRA019', 'Invalid cover note type'],
  ['TIRA020', 'Invalid covernote start date'],
  ['TIRA021', 'Invalid covernote end date'],
  ['TIRA022', 'Invalid insurance company'],
  ['TIRA023', 'Invalid insurance transaction company'],
  [
    'TIRA024',
    'Duplicate insurance covernote number or covernote identification number',
  ],
  ['TIRA025', 'Invalid or inactive insurance transaction sale point'],
  ['TIRA026', 'Invalid or inactive insurance transaction product'],
  ['TIRA027', 'Invalid or inactive insurance transaction currency'],
  ['TIRA028', 'Invalid transaction exchange rate'],
  ['TIRA029', 'Invalid insurance sum insured equivalent amount'],
  ['TIRA030', 'Invalid insurance covernote risk covered premium rate'],
  ['TIRA031', 'Invalid insurance premium amount (premium before discount)'],
  ['TIRA032', 'Invalid insurance tax code or tax type(s) charged'],
  ['TIRA033', 'Invalid insurance tax type rates used'],
  ['TIRA034', 'Invalid insurance tax type amount'],
  ['TIRA035', 'Invalid insurance total taxes or premium including tax value'],
  ['TIRA036', 'Invalid covernote reference number'],
  ['TIRA037', 'Duplicate reinsurance declaration'],
  ['TIRA038', 'Invalid reinsurance participant'],
  ['TIRA039', 'Invalid coinsurance premium amount value'],
  ['TIRA040', 'Invalid reinsurance participation share value'],
  ['TIRA041', 'Invalid reinsurance participation type'],
  ['TIRA042', 'Invalid insurer policy number'],
  ['TIRA043', 'Invalid policy operative clause'],
  ['TIRA044', 'Policy applied covernote(s) does not exist'],
  ['TIRA045', 'Duplicate policy'],
  ['TIRA046', 'Applied covernote(s) have policy'],
  ['TIRA047', 'Duplicate policy applied covernote(s)'],
  ['TIRA048', 'Notification content preparation failed'],
  ['TIRA049', 'No content returned by client system'],
  ['TIRA050', 'Error occurred while connecting to external system'],
  ['TIRA051', 'Client system not allowed for inbound communication'],
  ['TIRA052', 'Client system not allowed for outbound communication'],
  ['TIRA053', 'Invalid claim notification report date'],
  ['TIRA054', 'Invalid risk covered'],
  [
    'TIRA055',
    'Invalid premium charged after discount equivalent amount (premium excluding tax equivalent amount)',
  ],
  ['TIRA056', 'Duplicate claim notification number'],
  ['TIRA057', 'Invalid claim notification number'],
  ['TIRA058', 'Claimant exists for the specified covernote'],
  ['TIRA059', 'Invalid claim reference number'],
  ['TIRA060', 'Duplicate claim intimation'],
  ['TIRA061', 'Invalid claim intimation date'],
  ['TIRA062', 'Invalid claim intimation number'],
  ['TIRA063', 'Duplicate claim assessment number'],
  ['TIRA064', 'Invalid claim assessment received date'],
  ['TIRA065', 'Invalid claim approval date'],
  ['TIRA066', 'Invalid claim adjustment date'],
  ['TIRA067', 'Invalid claim offer communication date'],
  ['TIRA068', 'Invalid claimant claim offer response date'],
  ['TIRA069', 'Invalid offer reconciliation'],
  ['TIRA070', 'Claim assessment for the payment not found'],
  ['TIRA071', 'Duplicate claim payment number'],
  ['TIRA072', 'Claim has already been paid'],
  ['TIRA073', 'Invalid claim payment date'],
  ['TIRA074', 'Invalid claim payment currency'],
  ['TIRA075', 'Invalid claim payment amount'],
  ['TIRA076', 'Duplicate claim rejection number'],
  ['TIRA077', 'Invalid claim rejection date'],
  ['TIRA078', 'Invalid claim rejection. Claim already paid'],
  ['TIRA079', 'Invalid claim loss date'],
  ['TIRA080', 'Invalid reinsurance broker'],
  ['TIRA081', 'Invalid covernote type'],
  ['TIRA082', 'Invalid previous covernote reference number'],
  ['TIRA083', 'Invalid total premium including tax value'],
  ['TIRA084', 'Invalid total premium excluding tax value'],
  ['TIRA085', 'Invalid premium discount type'],
  ['TIRA086', 'Invalid premium discount amount'],
  ['TIRA087', 'Premium discount is not allowed for this type of cover'],
  ['TIRA088', 'Invalid acknowledgement'],
  ['TIRA089', 'Pending transaction waiting for processing'],
  [
    'TIRA090',
    'Active covernote with specified insurance product exists for this motor',
  ],
  ['TIRA091', 'Invalid risk covered premium after discount value'],
  ['TIRA092', 'Invalid claimant details'],
  ['TIRA093', 'Invalid claim assessment number'],
  ['TIRA094', 'Invalid claim litigation reason'],
  ['TIRA095', 'Invalid request identification number'],
  ['TIRA096', 'Invalid client system code'],
  ['TIRA097', 'Invalid covernote type'],
  ['TIRA098', 'Invalid covernote number'],
  ['TIRA099', 'Invalid covernote description'],
  ['TIRA100', 'Invalid covernote operative clause'],
  ['TIRA101', 'Invalid payment mode'],
  ['TIRA102', 'Invalid commission paid'],
  ['TIRA103', 'Invalid commission rate'],
  [
    'TIRA104',
    'Invalid value identifying if transaction is part of fleet or not',
  ],
  ['TIRA105', 'Invalid or duplicate fleet identification number'],
  ['TIRA106', 'Invalid fleet size'],
  ['TIRA107', 'Invalid total comprehensive insured motors value'],
  ['TIRA108', 'Invalid fleet entry'],
  ['TIRA109', 'Invalid insurance officer name'],
  ['TIRA110', 'Invalid insurance officer title'],
  ['TIRA111', 'Invalid insurance risk code'],
  ['TIRA112', 'Invalid insurance sum insured amount'],
  ['TIRA113', 'Invalid subject matter covered reference'],
  ['TIRA114', 'Invalid subject matter covered description'],
  ['TIRA115', 'Invalid insurance addon reference'],
  ['TIRA116', 'Invalid insurance addon description'],
  ['TIRA117', 'Invalid insurance addon premium amount'],
  ['TIRA118', 'Invalid insurance addon premium rate'],
  ['TIRA119', 'Invalid insurance addon premium excluding tax amount'],
  [
    'TIRA120',
    'Invalid insurance addon premium excluding tax equivalent amount',
  ],
  ['TIRA121', 'Invalid insurance addon premium including tax amount'],
  ['TIRA122', 'Invalid insurance policyholder name'],
  [
    'TIRA123',
    'Invalid insurance policyholder birth date or company registration date',
  ],
  ['TIRA124', 'Invalid insurance policyholder type'],
  [
    'TIRA125',
    'Invalid identity number or company incorporation certificate number',
  ],
  ['TIRA126', 'Invalid identity type'],
  ['TIRA127', 'Invalid gender'],
  ['TIRA128', 'Invalid country or country code'],
  ['TIRA129', 'Invalid region or state'],
  ['TIRA130', 'Invalid district or county'],
  ['TIRA131', 'Invalid street'],
  ['TIRA132', 'Invalid phone number'],
  ['TIRA133', 'Invalid fax number'],
  ['TIRA134', 'Invalid address'],
  ['TIRA135', 'Invalid email address'],
  ['TIRA136', 'Invalid motor category'],
  ['TIRA137', 'Invalid motor registration number'],
  ['TIRA138', 'Invalid motor chassis number'],
  ['TIRA139', 'Invalid motor make'],
  ['TIRA140', 'Invalid motor model'],
  ['TIRA141', 'Invalid motor model number'],
  ['TIRA142', 'Invalid motor body type'],
  ['TIRA143', 'Invalid motor color'],
  ['TIRA144', 'Invalid motor engine number'],
  ['TIRA145', 'Invalid motor engine capacity'],
  ['TIRA146', 'Invalid motor fuel used'],
  ['TIRA147', 'Invalid motor number of axles'],
  ['TIRA148', 'Invalid motor axle distance'],
  ['TIRA149', 'Invalid motor sitting capacity'],
  ['TIRA150', 'Invalid motor year of manufacture'],
  ['TIRA151', 'Invalid motor tare weight'],
  ['TIRA152', 'Invalid motor gross weight'],
  ['TIRA153', 'Invalid motor usage'],
  ['TIRA154', 'Invalid motor owner name'],
  ['TIRA155', 'Invalid motor owner category'],
  ['TIRA156', 'Invalid motor owner address'],
  ['TIRA157', 'Invalid policy special conditions'],
  ['TIRA158', 'Invalid policy exclusions'],
  ['TIRA159', 'Invalid insurance sticker number'],
  ['TIRA160', 'Invalid reinsurance category'],
  ['TIRA161', 'Invalid reinsurance participant or participant code'],
  ['TIRA162', 'Invalid reinsurance participant type'],
  ['TIRA163', 'Invalid reinsurance form'],
  ['TIRA164', 'Invalid reinsurance type'],
  ['TIRA165', 'Invalid reinsurance rebroker or rebroker code'],
  ['TIRA166', 'Invalid reinsurance rebrokerage commission value'],
  ['TIRA167', 'Invalid reinsurance commission value'],
  ['TIRA168', 'Invalid reinsurance premium share value'],
  ['TIRA169', 'Invalid reinsurance participation date'],
  ['TIRA170', 'Invalid value identifying if claim form is dully filled or not'],
  ['TIRA171', 'Invalid claim loss nature'],
  ['TIRA172', 'Invalid claim loss type'],
  ['TIRA173', 'Invalid claim loss location'],
  ['TIRA174', 'Invalid claim estimated amount'],
  ['TIRA175', 'Invalid claim reserved amount'],
  ['TIRA176', 'Invalid claim reserve method'],
  ['TIRA177', 'Invalid claim loss assessment option'],
  ['TIRA178', 'Invalid claim assessor name'],
  ['TIRA179', 'Invalid claim assessor identity number'],
  ['TIRA180', 'Invalid claim assessor identity type'],
  ['TIRA181', 'Invalid claimant name'],
  ['TIRA182', 'Invalid claimant birth date'],
  ['TIRA183', 'Invalid claimant category'],
  ['TIRA184', 'Invalid claimant type'],
  ['TIRA185', 'Invalid claimant identity number'],
  ['TIRA186', 'Invalid claimant identity type'],
  ['TIRA187', 'Invalid claim assessment report summary'],
  ['TIRA188', 'Invalid claim assessment amount'],
  ['TIRA189', 'Invalid claim approved amount'],
  ['TIRA190', 'Invalid claim approval date'],
  ['TIRA191', 'Invalid claim approval authority'],
  ['TIRA192', 'Invalid value identifying if its claim reassessment or not'],
  ['TIRA193', 'Invalid discharge voucher number'],
  ['TIRA194', 'Duplicate discharge voucher'],
  ['TIRA195', 'Invalid discharge voucher date'],
  ['TIRA196', 'Invalid claim discharge voucher offer communication date'],
  ['TIRA197', 'Invalid claim discharge voucher offer communicated amount'],
  ['TIRA198', 'Invalid claim discharge voucher offer response date'],
  ['TIRA199', 'Invalid claim discharge voucher offer adjustment date'],
  ['TIRA200', 'Invalid claim discharge voucher offer adjustment reason'],
  ['TIRA201', 'Invalid claim discharge voucher offer adjustment amount'],
  ['TIRA202', 'Invalid claim discharge voucher offer reconciliation date'],
  ['TIRA203', 'Invalid claim discharge voucher offer reconciliation reason'],
  ['TIRA204', 'Invalid claim discharge voucher offer reconciliation amount'],
  ['TIRA205', 'Invalid value identifying if offer was accepted or not'],
  ['TIRA206', 'Invalid claim payment number'],
  [
    'TIRA207',
    'Invalid value identifying if claim parties were notified about claim payment or not',
  ],
  ['TIRA208', 'Invalid claim net premium earned'],
  [
    'TIRA209',
    'Invalid value identifying if claim resulted into litigation or not',
  ],
  ['TIRA210', 'Invalid claim rejection number'],
  ['TIRA211', 'Invalid claim rejection reason'],
  ['TIRA212', 'Invalid endorsement type'],
  ['TIRA213', 'Invalid endorsement reason'],
  ['TIRA214', 'Invalid premium discount rate'],
  ['TIRA215', 'Invalid endorsement premium earned amount'],
  ['TIRA216', 'Invalid value identifying premium is tax exempted or not'],
  ['TIRA217', 'Invalid tax exemption type'],
  ['TIRA218', 'Invalid tax exemption reference'],
  ['TIRA219', 'Invalid motor type'],
  ['TIRA220', 'Active covernote with specified motor details exists'],
  ['TIRA221', 'Invalid fleet type'],
];

const responseCodeSeeds: ResponseCodeSeed[] = responseCodeSeedEntries.map(
  ([code, description]) => ({
    code,
    description,
    category: inferResponseCodeCategory(description),
    isSuccess: code === 'TIRA001' ? 1 : 0,
    isRetryable: inferRetryable(description),
  }),
);

async function seedClientConfigurations(activeDataSource = dataSource) {
  const configurationRepository = activeDataSource.getRepository(
    TiramisClientConfigurationEntity,
  );
  const endpointRepository = activeDataSource.getRepository(
    TiramisServiceEndpointEntity,
  );

  for (const configurationSeed of configurations) {
    const encryptedClientKey = encryptSecret(configurationSeed.clientKey);
    const encryptedClientPrivatePassword = encryptSecret(
      configurationSeed.clientPrivateCertificatePassword,
    );
    const encryptedTiraPublicPassword = encryptSecret(
      configurationSeed.tiraPublicCertificatePassword,
    );

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
    configuration.clientKey = encryptedClientKey;
    configuration.clientKeyEncrypted = encryptedClientKey;
    configuration.insurerCompanyCode = configurationSeed.insurerCompanyCode;
    configuration.salePointCode = configurationSeed.salePointCode;
    configuration.tranCompanyCode = configurationSeed.tranCompanyCode;
    configuration.baseUrl = configurationSeed.baseUrl;
    configuration.callbackBaseUrl = configurationSeed.callbackBaseUrl;
    configuration.clientPrivateCertificatePath =
      configurationSeed.clientPrivateCertificatePath;
    configuration.clientPrivateCertificatePassword =
      encryptedClientPrivatePassword;
    configuration.clientPrivateCertificatePasswordEncrypted =
      encryptedClientPrivatePassword;
    configuration.tiraPublicCertificatePath =
      configurationSeed.tiraPublicCertificatePath;
    configuration.tiraPublicCertificatePassword = encryptedTiraPublicPassword;
    configuration.tiraPublicCertificatePasswordEncrypted =
      encryptedTiraPublicPassword;
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

async function seedResponseCodes(activeDataSource = dataSource) {
  const responseCodeRepository = activeDataSource.getRepository(
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

export async function runTiramisConfigSeed(
  activeDataSource = dataSource,
): Promise<void> {
  const shouldManageConnection = !activeDataSource.isInitialized;

  if (shouldManageConnection) {
    await activeDataSource.initialize();
  }

  try {
    await seedClientConfigurations(activeDataSource);
    await seedResponseCodes(activeDataSource);

    console.log(
      'Seeded Tiramis client configurations, service endpoints, and response codes.',
    );
    console.log(
      'Note: NIN_VERIFICATION, COMPANY_VERIFICATION, and DETAILS_VERIFICATION endpoints are now seeded alongside the other supported verification endpoints.',
    );
  } finally {
    if (shouldManageConnection && activeDataSource.isInitialized) {
      await activeDataSource.destroy();
    }
  }
}

if (require.main === module) {
  void runTiramisConfigSeed().catch((error) => {
    console.error('Failed to seed Tiramis configuration:', error);
    process.exit(1);
  });
}
