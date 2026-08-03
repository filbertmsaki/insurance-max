import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TiramisSubmissionStatus } from '../../../tiramis/enums/tiramis-submission-status.enum';
import { PolicyCession } from '../entities/policy-cession.entity';
import { ReinsuranceDeclaration } from '../entities/reinsurance-declaration.entity';
import {
  ReinsuranceCessionStatus,
  ReinsuranceDeclarationStatus,
} from '../enums/reinsurance.enums';

@Injectable()
export class ReinsuranceDeclarationSyncService {
  constructor(
    @InjectRepository(ReinsuranceDeclaration)
    private readonly declarationRepository: Repository<ReinsuranceDeclaration>,

    @InjectRepository(PolicyCession)
    private readonly cessionRepository: Repository<PolicyCession>,
  ) {}

  async syncDeclaration(declarationId: string) {
    const declaration = await this.declarationRepository.findOne({
      where: { id: declarationId },
    });

    if (!declaration) {
      return null;
    }

    const status = declaration.tiramis_status;

    if (status === TiramisSubmissionStatus.FINAL_SUCCESS) {
      declaration.status = ReinsuranceDeclarationStatus.ACCEPTED;
      await this.cessionRepository.update(
        { id: declaration.cession_id },
        { status: ReinsuranceCessionStatus.DECLARED },
      );
    } else if (
      [
        TiramisSubmissionStatus.FINAL_FAILED,
        TiramisSubmissionStatus.FAILED,
        TiramisSubmissionStatus.ACK_FAILED,
        TiramisSubmissionStatus.RETRY_EXHAUSTED,
      ].includes(status as TiramisSubmissionStatus)
    ) {
      declaration.status = ReinsuranceDeclarationStatus.FAILED;
    }

    return this.declarationRepository.save(declaration);
  }
}
