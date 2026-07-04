import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TiramisClaimEntity } from '../entities/tiramis-claim.entity';

@Injectable()
export class TiramisClaimRepository {
  constructor(
    @InjectRepository(TiramisClaimEntity)
    private readonly repository: Repository<TiramisClaimEntity>,
  ) {}

  create(data: Partial<TiramisClaimEntity>) {
    return this.repository.create(data);
  }

  save(claim: TiramisClaimEntity) {
    return this.repository.save(claim);
  }

  findById(id: string) {
    return this.repository.findOne({
      where: { id },
    });
  }

  findByRequestId(requestId: string) {
    return this.repository.findOne({
      where: { requestId },
    });
  }

  findByClaimNotificationNumber(claimNotificationNumber: string) {
    return this.repository.findOne({
      where: { claimNotificationNumber },
    });
  }

  findByClaimIntimationNumber(claimIntimationNumber: string) {
    return this.repository.findOne({
      where: { claimIntimationNumber },
    });
  }

  findByClaimAssessmentNumber(claimAssessmentNumber: string) {
    return this.repository.findOne({
      where: { claimAssessmentNumber },
    });
  }

  findByClaimPaymentNumber(claimPaymentNumber: string) {
    return this.repository.findOne({
      where: { claimPaymentNumber },
    });
  }

  findByClaimRejectionNumber(claimRejectionNumber: string) {
    return this.repository.findOne({
      where: { claimRejectionNumber },
    });
  }

  findByClaimReferenceNumber(claimReferenceNumber: string) {
    return this.repository.findOne({
      where: { claimReferenceNumber },
    });
  }

  findByCoverNoteReferenceNumber(coverNoteReferenceNumber: string) {
    return this.repository.find({
      where: { coverNoteReferenceNumber },
      order: { createdAt: 'DESC' },
    });
  }

  async markFinalResponseByRequestId(params: {
    requestId: string;
    responseId: string;
    statusCode: string;
    statusDesc: string;
    payload: Record<string, any>;
    claimReferenceNumber?: string | null;
  }) {
    await this.repository.update(
      { requestId: params.requestId },
      {
        claimReferenceNumber: params.claimReferenceNumber || undefined,
        finalResponseId: params.responseId,
        finalResponseStatusCode: params.statusCode,
        finalResponseStatusDesc: params.statusDesc,
        finalResponseReceivedAt: new Date(),
        finalResponsePayload: params.payload,
      },
    );

    return this.findByRequestId(params.requestId);
  }
}
