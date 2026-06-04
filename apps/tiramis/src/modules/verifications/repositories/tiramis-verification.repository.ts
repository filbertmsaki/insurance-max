import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TiramisVerificationRequestEntity } from '../entities/tiramis-verification-request.entity';
import { TiramisVerificationResponseEntity } from '../entities/tiramis-verification-response.entity';

@Injectable()
export class TiramisVerificationRepository {
  constructor(
    @InjectRepository(TiramisVerificationRequestEntity)
    private readonly requestRepository: Repository<TiramisVerificationRequestEntity>,
    @InjectRepository(TiramisVerificationResponseEntity)
    private readonly responseRepository: Repository<TiramisVerificationResponseEntity>,
  ) {}

  createRequest(data: Partial<TiramisVerificationRequestEntity>) {
    return this.requestRepository.create(data);
  }

  saveRequest(entity: TiramisVerificationRequestEntity) {
    return this.requestRepository.save(entity);
  }

  createResponse(data: Partial<TiramisVerificationResponseEntity>) {
    return this.responseRepository.create(data);
  }

  saveResponse(entity: TiramisVerificationResponseEntity) {
    return this.responseRepository.save(entity);
  }

  findRequestById(id: string) {
    return this.requestRepository.findOne({
      where: { id },
      relations: {
        response: true,
      },
    });
  }

  findRequestByRequestId(requestId: string) {
    return this.requestRepository.findOne({
      where: { requestId },
      relations: {
        response: true,
      },
    });
  }

  findResponsesByRequestId(requestId: string) {
    return this.responseRepository.find({
      where: { requestId },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  findByCoverNoteReferenceNumber(coverNoteReferenceNumber: string) {
    return this.requestRepository.find({
      where: { coverNoteReferenceNumber },
      relations: {
        response: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  findByNin(nin: string) {
    return this.requestRepository.find({
      where: { nin },
      relations: {
        response: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  findByIncorporationCertificateNumber(
    incorporationCertificateNumber: string,
  ) {
    return this.requestRepository.find({
      where: { incorporationCertificateNumber },
      relations: {
        response: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }
}
