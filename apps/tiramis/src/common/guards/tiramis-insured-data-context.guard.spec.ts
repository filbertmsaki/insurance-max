import { createHash } from 'node:crypto';

import { ForbiddenException } from '@nestjs/common';

import { TiramisInsuredDataContextGuard } from './tiramis-insured-data-context.guard';

describe('TiramisInsuredDataContextGuard', () => {
  const guard = new TiramisInsuredDataContextGuard();

  it('allows a verified request with matching policyholder and asset manifests', () => {
    const body = {
      policyHolders: [
        {
          policyHolderName: 'Jane Doe',
          policyHolderBirthDate: '1990-02-03',
          policyHolderType: 1,
          policyHolderIdNumber: 'NIN-123-456',
          policyHolderIdType: 4,
          phoneNumber: '+255 700 000 001',
          emailAddress: 'Jane.Doe@example.com',
        },
      ],
      motorDetail: {
        registrationNumber: 'T 123 ABC',
        chassisNumber: 'CHS-9988',
        engineNumber: 'ENG-11',
        make: 'Toyota',
        model: 'Hilux',
        yearOfManufacture: 2022,
        ownerName: 'Jane Doe',
      },
    };

    const policyHolderManifest = [
      {
        policyHolderName: 'Jane Doe',
        policyHolderBirthDate: '1990-02-03',
        policyHolderType: 1,
        policyHolderIdNumber: 'NIN123456',
        policyHolderIdType: 4,
        phoneNumber: '+255700000001',
        email: 'jane.doe@example.com',
      },
    ];

    const assetManifest = [
      {
        registrationNumber: 'T123ABC',
        chassisNumber: 'CHS9988',
        engineNumber: 'ENG11',
        make: 'Toyota',
        model: 'Hilux',
        yearOfManufacture: 2022,
        ownerName: 'Jane Doe',
      },
    ];

    const context = createExecutionContext({
      body,
      servicePrincipal: {
        insuredData: {
          customerId: 'customer-1',
          customerNumber: 'CUST-001',
          customerKycStatus: 'VERIFIED',
          customerKycVersion: 3,
          customerSnapshotHash: hashDefinition(policyHolderManifest),
          tiramisPolicyHolderHash: hashDefinition(policyHolderManifest),
          assetManifestHash: hashDefinition(assetManifest),
          assetCount: 1,
          manifestVersion: '8.1',
        },
      },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a request when the signed asset manifest does not match the payload', () => {
    const body = {
      policyHolders: [
        {
          policyHolderName: 'Jane Doe',
          policyHolderBirthDate: '1990-02-03',
          policyHolderType: 1,
          policyHolderIdNumber: 'NIN-123-456',
          policyHolderIdType: 4,
          phoneNumber: '+255 700 000 001',
          emailAddress: 'Jane.Doe@example.com',
        },
      ],
      motorDetail: {
        registrationNumber: 'T 123 ABC',
        chassisNumber: 'CHS-9988',
        engineNumber: 'ENG-11',
        make: 'Toyota',
        model: 'Hilux',
        yearOfManufacture: 2022,
        ownerName: 'Changed Owner',
      },
    };

    const policyHolderManifest = [
      {
        policyHolderName: 'Jane Doe',
        policyHolderBirthDate: '1990-02-03',
        policyHolderType: 1,
        policyHolderIdNumber: 'NIN123456',
        policyHolderIdType: 4,
        phoneNumber: '+255700000001',
        email: 'jane.doe@example.com',
      },
    ];

    const signedAssetManifest = [
      {
        registrationNumber: 'T123ABC',
        chassisNumber: 'CHS9988',
        engineNumber: 'ENG11',
        make: 'Toyota',
        model: 'Hilux',
        yearOfManufacture: 2022,
        ownerName: 'Jane Doe',
      },
    ];

    const context = createExecutionContext({
      body,
      servicePrincipal: {
        insuredData: {
          customerId: 'customer-1',
          customerNumber: 'CUST-001',
          customerKycStatus: 'VERIFIED',
          customerKycVersion: 3,
          customerSnapshotHash: hashDefinition(policyHolderManifest),
          tiramisPolicyHolderHash: hashDefinition(policyHolderManifest),
          assetManifestHash: hashDefinition(signedAssetManifest),
          assetCount: 1,
          manifestVersion: '8.1',
        },
      },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);

    try {
      guard.canActivate(context);
    } catch (error) {
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'TIRAMIS_INSURED_DATA_HASH_MISMATCH',
      });
    }
  });
});

function createExecutionContext(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as any;
}

function hashDefinition(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(sortValue(value)), 'utf8')
    .digest('hex');
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortValue((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }

  if (typeof value === 'string') {
    return value.trim().replace(/\r\n/g, '\n');
  }

  return value;
}
