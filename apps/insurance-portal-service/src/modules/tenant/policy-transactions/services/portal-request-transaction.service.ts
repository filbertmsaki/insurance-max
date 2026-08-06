import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { CancellationReasonType } from '@insurance-max/contracts';

import { PortalServiceRequest } from '../../portal/entities/portal-service-request.entity';
import { PortalRequestType } from '../../portal/enums/portal.enums';
import { EndorsementService } from './endorsement.service';
import { CancellationService } from './cancellation.service';
import { RenewalService } from './renewal.service';

/**
 * Bridges an approved customer/intermediary portal request
 * (`modules/tenant/portal`) into a controlled operational transaction
 * (§13.28). The portal request itself always remains an intake record —
 * this only creates the endorsement/cancellation/renewal draft the first
 * time a request is completed, and returns the existing one on repeat
 * calls (idempotent).
 */
@Injectable()
export class PortalRequestTransactionService {
  constructor(
    private readonly endorsementService: EndorsementService,
    private readonly cancellationService: CancellationService,
    private readonly renewalService: RenewalService,
  ) {}

  async createFromApprovedRequest(
    user: AuthenticatedUser,
    request: PortalServiceRequest,
  ) {
    if (request.operational_resource_id) {
      return {
        resourceType: request.operational_resource_type,
        resourceId: request.operational_resource_id,
      };
    }

    if (!request.policy_id) {
      throw new BadRequestException(
        'Portal request has no linked policy to act on.',
      );
    }

    const payload = request.payload ?? {};

    switch (request.request_type) {
      case PortalRequestType.ENDORSEMENT: {
        const transaction = await this.endorsementService.create(user, request.policy_id, {
          effective_date: String(payload.effective_date),
          endorsement_type_code: String(payload.endorsement_type_code),
          reason: request.description,
          idempotency_key: `portal-request:${request.id}`,
        });

        return this.stampResource(request, 'ENDORSEMENT', transaction.id);
      }

      case PortalRequestType.CANCELLATION: {
        const transaction = await this.cancellationService.create(
          user,
          request.policy_id,
          {
            effective_date: String(payload.effective_date),
            reason_type:
              (payload.reason_type as CancellationReasonType) ??
              CancellationReasonType.CUSTOMER_REQUEST,
            reason: request.description,
            idempotency_key: `portal-request:${request.id}`,
          },
        );

        return this.stampResource(request, 'CANCELLATION', transaction.id);
      }

      case PortalRequestType.RENEWAL: {
        // Renewal candidates are created by the scheduled eligibility job;
        // an accepted portal renewal request simply records the customer's
        // acceptance against the existing renewal offer, identified by the
        // request's target_id.
        if (!request.target_id) {
          throw new BadRequestException(
            'Portal renewal request is missing the target renewal offer.',
          );
        }

        const renewal = await this.renewalService.accept(
          user,
          request.target_id,
        );

        return this.stampResource(request, 'RENEWAL', renewal.id);
      }

      default:
        throw new BadRequestException(
          `Portal request type ${request.request_type} does not create an operational transaction.`,
        );
    }
  }

  private stampResource(
    request: PortalServiceRequest,
    resourceType: string,
    resourceId: string,
  ) {
    request.operational_resource_type = resourceType;
    request.operational_resource_id = resourceId;
    request.operational_created_at = new Date();

    return { resourceType, resourceId, request };
  }
}
