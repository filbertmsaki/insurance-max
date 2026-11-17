import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ClaimReserveMovementType } from '@insurance-max/contracts';

import { BusinessReferenceService } from '../../../shared/identifiers/business-reference.service';
import { MoneyUtil } from '../../billing-commission/utils/money.util';
import { ClaimReserve } from '../entities/claim-reserve.entity';
import { ClaimReserveMovement } from '../entities/claim-reserve-movement.entity';
import { ClaimFxGovernanceService } from './claim-fx-governance.service';

@Injectable()
export class ClaimReserveMovementService {
  constructor(
    private readonly referenceService: BusinessReferenceService,
    private readonly fx: ClaimFxGovernanceService,
  ) {}

  /**
   * Records one immutable movement (§14.7). `signedAmount` must already
   * carry the correct sign for `movementType` (positive for
   * INITIAL/INCREASE/REOPEN, negative for DECREASE/RELEASE).
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
    const sign = MoneyUtil.compare(signedAmount, '0');
    if (
      (new Set<ClaimReserveMovementType>([
        ClaimReserveMovementType.INITIAL,
        ClaimReserveMovementType.INCREASE,
        ClaimReserveMovementType.REOPEN,
      ]).has(movementType) &&
        sign < 0) ||
      (new Set<ClaimReserveMovementType>([
        ClaimReserveMovementType.DECREASE,
        ClaimReserveMovementType.RELEASE,
        ClaimReserveMovementType.PAYMENT_REDUCTION,
      ]).has(movementType) &&
        sign > 0)
    ) {
      throw new BadRequestException(
        'Reserve movement sign does not match its type',
      );
    }
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

    const movement = await manager.getRepository(ClaimReserveMovement).save({
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
    const effectiveAt =
      movementType === ClaimReserveMovementType.RELEASE && reserve.released_at
        ? reserve.released_at
        : reserve.effective_at;
    await this.fx.snapshot(manager, {
      companyId: reserve.company_id,
      claimId: reserve.claim_id,
      eventType: 'RESERVE_MOVEMENT',
      eventId: movement.id,
      currency: reserve.currency,
      eventDate: effectiveAt.toISOString().slice(0, 10),
      amount: signedAmount,
    });
    return movement;
  }
}
