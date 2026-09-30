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
      'portalWebhookUrl',
    ];
    for (const field of fields) {
      const value = (metadata as Record<string, unknown>)[field];
      if (value != null && typeof value !== 'string') {
        throw new Error('Invalid source metadata');
      }
    }

    const portalWebhookUrl = (metadata as TiramisSourceMetadataDto)
      .portalWebhookUrl;
    if (portalWebhookUrl) {
      const parsedUrl = new URL(portalWebhookUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid portal webhook URL');
      }
    }

    return metadata;
  } catch {
    throw new BadRequestException('Invalid TIRAMIS source metadata header');
  }
}

/**
 * Every business submission must name the portal webhook that receives its
 * final TIRA outcome. There is deliberately no env fallback: a transaction
 * stored without this URL silently drops its callback result.
 */
export function requirePortalWebhookUrl(value?: string | null): string {
  const portalWebhookUrl = value?.trim();

  if (!portalWebhookUrl) {
    throw new BadRequestException({
      code: 'TIRAMIS_PORTAL_WEBHOOK_URL_REQUIRED',
      message:
        'portalWebhookUrl is required in the TIRAMIS source metadata for every submission.',
    });
  }

  let protocol: string;
  try {
    protocol = new URL(portalWebhookUrl).protocol;
  } catch {
    protocol = '';
  }

  if (!['http:', 'https:'].includes(protocol)) {
    throw new BadRequestException({
      code: 'TIRAMIS_PORTAL_WEBHOOK_URL_INVALID',
      message: 'portalWebhookUrl must be an absolute http(s) URL.',
    });
  }

  return portalWebhookUrl;
}
