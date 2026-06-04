import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TiramisClaimAssessmentEntity } from '../entities/tiramis-claim-assessment.entity';
import { TiramisClaimIntimationEntity } from '../entities/tiramis-claim-intimation.entity';
import { TiramisClaimNotificationEntity } from '../entities/tiramis-claim-notification.entity';
import { TiramisClaimPaymentEntity } from '../entities/tiramis-claim-payment.entity';
import { TiramisClaimRejectionEntity } from '../entities/tiramis-claim-rejection.entity';
import { TiramisDischargeVoucherEntity } from '../entities/tiramis-discharge-voucher.entity';

@Injectable()
export class TiramisClaimRepository {
  constructor(
    @InjectRepository(TiramisClaimNotificationEntity)
    private readonly notificationRepository: Repository<TiramisClaimNotificationEntity>,
    @InjectRepository(TiramisClaimIntimationEntity)
    private readonly intimationRepository: Repository<TiramisClaimIntimationEntity>,
    @InjectRepository(TiramisClaimAssessmentEntity)
    private readonly assessmentRepository: Repository<TiramisClaimAssessmentEntity>,
    @InjectRepository(TiramisDischargeVoucherEntity)
    private readonly dischargeVoucherRepository: Repository<TiramisDischargeVoucherEntity>,
    @InjectRepository(TiramisClaimPaymentEntity)
    private readonly paymentRepository: Repository<TiramisClaimPaymentEntity>,
    @InjectRepository(TiramisClaimRejectionEntity)
    private readonly rejectionRepository: Repository<TiramisClaimRejectionEntity>,
  ) {}

  createNotification(data: Partial<TiramisClaimNotificationEntity>) {
    return this.notificationRepository.create(data);
  }

  saveNotification(entity: TiramisClaimNotificationEntity) {
    return this.notificationRepository.save(entity);
  }

  createIntimation(data: Partial<TiramisClaimIntimationEntity>) {
    return this.intimationRepository.create(data);
  }

  saveIntimation(entity: TiramisClaimIntimationEntity) {
    return this.intimationRepository.save(entity);
  }

  createAssessment(data: Partial<TiramisClaimAssessmentEntity>) {
    return this.assessmentRepository.create(data);
  }

  saveAssessment(entity: TiramisClaimAssessmentEntity) {
    return this.assessmentRepository.save(entity);
  }

  createDischargeVoucher(data: Partial<TiramisDischargeVoucherEntity>) {
    return this.dischargeVoucherRepository.create(data);
  }

  saveDischargeVoucher(entity: TiramisDischargeVoucherEntity) {
    return this.dischargeVoucherRepository.save(entity);
  }

  createPayment(data: Partial<TiramisClaimPaymentEntity>) {
    return this.paymentRepository.create(data);
  }

  savePayment(entity: TiramisClaimPaymentEntity) {
    return this.paymentRepository.save(entity);
  }

  createRejection(data: Partial<TiramisClaimRejectionEntity>) {
    return this.rejectionRepository.create(data);
  }

  saveRejection(entity: TiramisClaimRejectionEntity) {
    return this.rejectionRepository.save(entity);
  }

  findNotificationByRequestId(requestId: string) {
    return this.notificationRepository.findOne({ where: { requestId } });
  }

  findIntimationByRequestId(requestId: string) {
    return this.intimationRepository.findOne({
      where: { requestId },
      relations: { claimants: true },
    });
  }

  findAssessmentByRequestId(requestId: string) {
    return this.assessmentRepository.findOne({
      where: { requestId },
      relations: { claimants: true },
    });
  }

  findDischargeVoucherByRequestId(requestId: string) {
    return this.dischargeVoucherRepository.findOne({
      where: { requestId },
      relations: { claimants: true },
    });
  }

  findPaymentByRequestId(requestId: string) {
    return this.paymentRepository.findOne({
      where: { requestId },
      relations: { claimants: true },
    });
  }

  findRejectionByRequestId(requestId: string) {
    return this.rejectionRepository.findOne({
      where: { requestId },
      relations: { claimants: true },
    });
  }
}
