import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ClaimReserveMovementType } from '@insurance-max/contracts';

import { BusinessReferenceService } from '../../../shared/identifiers/business-reference.service';
import { MoneyUtil } from '../../billing-commission/utils/money.util';
import { ClaimReserve } from '../entities/claim-reserve.entity';
import { ClaimReserveMovement } from '../entities/claim-reserve-movement.entity';

@Injectable()
export class ClaimReserveMovementService {
  constructor(private readonly referenceService: BusinessReferenceService) {}

  /**
   * Records one immutable movement (§14.7). `signedAmount` must already
   * carry the correct sign for `movementType` (positive for
   * INITIAL/INCREASE/REOPEN, negative for DECREASE/RELEASE) — the DB CHECK
   * constraint enforces this too.
   */
  async record(
    manager: EntityManager,
    reserve: ClaimReserve,
    movementType: ClaimReserveMovementType,
    signedAmount: string,
    reason: string,
    sourceEventId: string,
    userId: string | null,
  ): Promise<ClaimReserveMovement> {
    const existing = await manager.getRepository(ClaimReserveMovement).findOne({
      where: {
        company_id: reserve.company_id,
        source_event_id: sourceEventId,
      },
    });

    if (existing) {
      return existing;
    }

    const movementNo = await this.referenceService.next({
      companyId: reserve.company_id,
      documentType: 'CLAIM_RESERVE_MOVEMENT',
      prefix: 'RSM-',
      manager,
    });

    return manager.getRepository(ClaimReserveMovement).save({
      company_id: reserve.company_id,
      claim_id: reserve.claim_id,
      reserve_id: reserve.id,
      movement_no: movementNo,
      movement_type: movementType,
      amount:
        MoneyUtil.compare(signedAmount, '0.00') < 0
          ? MoneyUtil.subtract('0.00', signedAmount)
          : signedAmount,
      signed_amount: signedAmount,
      currency_code: reserve.currency,
      effective_at: reserve.effective_at,
      reason,
      source_event_id: sourceEventId,
      created_by: userId,
    });
  }
}
