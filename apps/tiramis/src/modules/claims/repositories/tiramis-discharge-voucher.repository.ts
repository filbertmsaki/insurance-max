import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TiramisDischargeVoucherEntity } from '../entities/tiramis-discharge-voucher.entity';

@Injectable()
export class TiramisDischargeVoucherRepository {
  constructor(
    @InjectRepository(TiramisDischargeVoucherEntity)
    private readonly repository: Repository<TiramisDischargeVoucherEntity>,
  ) {}

  create(data: Partial<TiramisDischargeVoucherEntity>) {
    return this.repository.create(data);
  }

  save(dischargeVoucher: TiramisDischargeVoucherEntity) {
    return this.repository.save(dischargeVoucher);
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

  findByDischargeVoucherNumber(dischargeVoucherNumber: string) {
    return this.repository.findOne({
      where: { dischargeVoucherNumber },
    });
  }

  async markFinalResponseByRequestId(params: {
    requestId: string;
    responseId: string;
    statusCode: string;
    statusDesc: string;
    payload: Record<string, any>;
    claimReferenceNumber?: string | null;
    transactionId?: string | null;
  }) {
    const changes = {
      claimReferenceNumber: params.claimReferenceNumber || undefined,
      finalResponseId: params.responseId,
      finalResponseStatusCode: params.statusCode,
      finalResponseStatusDesc: params.statusDesc,
      finalResponseReceivedAt: new Date(),
      finalResponsePayload: params.payload,
    };
    const result = await this.repository.update(
      { requestId: params.requestId },
      changes,
    );

    if (!result.affected && params.transactionId) {
      await this.repository.update(
        { transactionId: params.transactionId },
        { ...changes, requestId: params.requestId },
      );
    }

    return this.findByRequestId(params.requestId);
  }
}
