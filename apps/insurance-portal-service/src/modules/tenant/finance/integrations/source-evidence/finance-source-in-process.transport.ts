import { ForbiddenException, Provider } from '@nestjs/common';
import {
  FINANCE_SOURCE_DELIVERY_TRANSPORT,
  type FinanceSourceTransport,
} from './finance-source-delivery.service';
import { FinanceSourceAttestationsService } from './finance-source-attestations.service';

/**
 * Replaces the former HTTPS hop to the standalone Finance Service. The outbox,
 * worker authority, signed receipt and attempt history are unchanged; only the
 * hop is now an in-process call to the attestation registry in the same database.
 */
export function inProcessSourceTransport(
  attestations: FinanceSourceAttestationsService,
): FinanceSourceTransport {
  return async ({ body, signature, archiveExpired }) => {
    const result = await attestations.ingest(body, signature, archiveExpired);
    const receipt = await attestations.signedReceipt(result.id);
    if (!receipt)
      throw new ForbiddenException('A signed Finance receipt is required.');
    return receipt;
  };
}

export const FINANCE_SOURCE_IN_PROCESS_TRANSPORT: Provider = {
  provide: FINANCE_SOURCE_DELIVERY_TRANSPORT,
  useFactory: inProcessSourceTransport,
  inject: [FinanceSourceAttestationsService],
};
