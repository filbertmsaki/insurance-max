import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CoverNote } from './entities/cover-note.entity';
import { TiramisSubmissionTrackingEntity } from '../../tiramis/entities/tiramis-submission-tracking.entity';
import { IssuanceService } from '../issuance/issuance.service';
import { QuotationsService } from '../quotations/quotations.service';
import { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { PortalTiraSubmission } from '../tiramis-integration/entities/portal-tira-submission.entity';
import { PortalTiraSubmissionStatus } from '../tiramis-integration/enums/portal-tira-submission-status.enum';
import type { RegulatoryFinalResponse } from '@insurance-max/contracts';

@Injectable()
export class CoverNotesService {
  constructor(
    @InjectRepository(CoverNote)
    private readonly coverNoteRepository: Repository<CoverNote>,
    @InjectRepository(TiramisSubmissionTrackingEntity)
    private readonly trackingRepository: Repository<TiramisSubmissionTrackingEntity>,
    @InjectRepository(PortalTiraSubmission)
    private readonly portalSubmissionRepository: Repository<PortalTiraSubmission>,
    private readonly quotationsService: QuotationsService,
    private readonly issuanceService: IssuanceService,
  ) {}

  async issueForQuotation(
    companyId: string,
    quotationId: string,
    user: AuthenticatedUser,
  ) {
    const quotation = await this.quotationsService.findOneForUser(
      user,
      quotationId,
    );
    if (quotation.tira_status !== 'SUCCESS') {
      throw new NotFoundException(
        'TIRA-accepted quotation submission not found',
      );
    }
    const tracking = await this.trackingRepository.findOne({
      where: {
        sourceCompanyId: companyId,
        quotationId,
        canonicalStatus: 'FINAL_SUCCESS',
      },
      order: { acknowledgedAt: 'DESC', createdAt: 'DESC' },
    });
    if (!tracking)
      throw new NotFoundException(
        'Accepted TIRA cover-note submission not found',
      );
    const alreadyIssued = await this.coverNoteRepository.findOne({
      where: {
        company_id: companyId,
        quotation_id: quotationId,
        tiramis_tracking_id: tracking.id,
      },
    });
    if (alreadyIssued) return this.findAll(companyId, { quotationId });
    const submission = await this.portalSubmissionRepository.findOne({
      where: {
        company_id: companyId,
        quotation_id: quotationId,
        tiramis_transaction_id: tracking.tiramisTransactionId ?? undefined,
        status: PortalTiraSubmissionStatus.FINAL_SUCCESS,
      },
    });
    if (!submission)
      throw new NotFoundException('Completed portal submission not found');
    const issued = await this.issuanceService.applyNotification(submission, {
      requestId: tracking.tiramisRequestId ?? '',
      eventType: 'TIRAMIS_FINAL_SUCCESS',
      serviceType: tracking.tiramisServiceType ?? tracking.requestType,
      responseId: tracking.finalResponseId ?? undefined,
      coverNoteReferenceNumber:
        submission.cover_note_reference_number ?? undefined,
      policyReferenceNumber: submission.policy_reference_number ?? undefined,
      stickerNumber: submission.sticker_number ?? undefined,
      regulatoryResponse:
        tracking.finalResponsePayload as unknown as RegulatoryFinalResponse,
    });
    return issued?.coverNotes ?? [];
  }

  findAll(
    companyId: string,
    filters: { policyId?: string; quotationId?: string } = {},
  ) {
    return this.coverNoteRepository.find({
      where: {
        company_id: companyId,
        ...(filters.policyId ? { policy_id: filters.policyId } : {}),
        ...(filters.quotationId ? { quotation_id: filters.quotationId } : {}),
      },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(companyId: string, id: string) {
    const coverNote = await this.coverNoteRepository.findOne({
      where: { id, company_id: companyId },
    });

    if (!coverNote) {
      throw new NotFoundException('Cover note not found');
    }

    return coverNote;
  }
}
