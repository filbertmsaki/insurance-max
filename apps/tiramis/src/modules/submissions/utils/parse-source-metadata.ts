import { BadRequestException } from '@nestjs/common';

import type { TiramisSourceMetadataDto } from '../dto/tiramis-source-metadata.dto';

export function parseSourceMetadata(
  encoded?: string,
): TiramisSourceMetadataDto | undefined {
  if (!encoded) return undefined;

  try {
    const metadata: unknown = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    );
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      throw new Error('Invalid source metadata');
    }

    const fields = [
      'sourceService',
      'sourceCompanyId',
      'sourceUserId',
      'sourceModule',
      'sourceRecordId',
      'policyId',
      'quotationId',
      'businessReference',
      'requestType',
      'requestId',
    ];
    for (const field of fields) {
      const value = (metadata as Record<string, unknown>)[field];
      if (value != null && typeof value !== 'string') {
        throw new Error('Invalid source metadata');
      }
    }

    return metadata as TiramisSourceMetadataDto;
  } catch {
    throw new BadRequestException('Invalid TIRAMIS source metadata header');
  }
}
