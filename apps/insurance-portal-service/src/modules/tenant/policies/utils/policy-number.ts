import type { EntityManager } from 'typeorm';
import { BusinessReferenceService } from '../../../shared/identifiers/business-reference.service';
import { ProductChannelType } from '../../product-distribution/enums/product-channel-type.enum';

/** Channel code in a policy number: `POL-DIR-2026-00001`. */
export function policyNoChannelCode(channelType: ProductChannelType): string {
  return channelType === ProductChannelType.DIRECT
    ? 'DIR'
    : channelType.slice(0, 3);
}

export function policyNoPrefix(
  channelType: ProductChannelType,
  date = new Date(),
): string {
  return `POL-${policyNoChannelCode(channelType)}-${date.getFullYear()}-`;
}

/** One counter per company, channel code and year. */
export function policyNoDocumentType(channelType: ProductChannelType): string {
  return `POLICY_${policyNoChannelCode(channelType)}`;
}

/**
 * Next policy number from the atomic per-company counter
 * (`business_document_sequences`). Replaces the old "highest number + 1"
 * read, which let concurrent issuances pick the same number. Run it on the
 * caller's transaction so the counter row stays locked until commit.
 */
export function nextPolicyNo(
  manager: EntityManager,
  companyId: string,
  channelType: ProductChannelType,
  date = new Date(),
): Promise<string> {
  return new BusinessReferenceService(manager.connection).next({
    manager,
    companyId,
    documentType: policyNoDocumentType(channelType),
    prefix: policyNoPrefix(channelType, date),
    periodKey: String(date.getFullYear()),
    sequenceLength: 5,
  });
}
