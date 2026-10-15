import type { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';
import { paginateQueryBuilder } from '@insurance-max/portal-shared/utils/paginate-query.util';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CoverNote } from './entities/cover-note.entity';
import { TiramisSubmissionTrackingEntity } from '../../tiramis/entities/tiramis-submission-tracking.entity';
import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';
import { IssuanceService } from '../issuance/issuance.service';
import { QuotationsService } from '../quotations/quotations.service';
import { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { PortalTiraSubmission } from '../tiramis-integration/entities/portal-tira-submission.entity';
import { PortalTiraSubmissionStatus } from '../tiramis-integration/enums/portal-tira-submission-status.enum';
import type { RegulatoryFinalResponse } from '@insurance-max/contracts';

/**
 * Read model for cover notes, plus a manual re-sync of an issuance TIRA has
 * already accepted. Cover notes are normally created automatically by
 * IssuanceService when the TIRAMIS outcome arrives; `issueForQuotation`
 * replays that same idempotent pipeline when the automatic path missed it.
 */
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
    private readonly scopeService: DataAccessScopeService,
  ) {}

  async issueForQuotation(user: AuthenticatedUser, quotationId: string) {
    const companyId = user.companyId!;
    const quotation = await this.quotationsService.findOneForUser(
      user,
      quotationId,
    );
    if (quotation.tira_status !== 'SUCCESS') {
      throw new ConflictException(
        'Cover notes can only be re-synced for a quotation TIRA has accepted',
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
    if (alreadyIssued) return this.findAll(user, { quotationId });
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
    if (!issued) {
      throw new ConflictException(
        'The accepted submission does not issue cover notes (for example a policy transaction)',
      );
    }
    return issued.coverNotes;
  }

  findAll(
    user: AuthenticatedUser,
    filters: { policyId?: string; quotationId?: string } = {},
  ) {
    return this.filteredQuery(user, filters)
      .orderBy('cover_note.created_at', 'DESC')
      .getMany();
  }

  /** Paged cover notes over the same scoped query (fleet policies can hold hundreds). */
  findPage(
    user: AuthenticatedUser,
    filters: { policyId?: string; quotationId?: string },
    table: TableQueryDto,
  ) {
    return paginateQueryBuilder(this.filteredQuery(user, filters), table, {
      sortable: {
        created_at: 'cover_note.created_at',
        cover_note_number: 'cover_note.cover_note_number',
        fleet_entry: 'cover_note.fleet_entry',
        start_date: 'cover_note.start_date',
        status: 'cover_note.status',
      },
      defaultSort: 'created_at',
      searchable: [
        'cover_note.cover_note_number',
        'cover_note.cover_note_reference_number',
        'cover_note.sticker_number',
      ],
      tieBreaker: 'cover_note.id',
    });
  }

  private filteredQuery(
    user: AuthenticatedUser,
    filters: { policyId?: string; quotationId?: string },
  ) {
    const queryBuilder = this.scopedQuery(user);

    if (filters.policyId) {
      queryBuilder.andWhere('cover_note.policy_id = :policyId', {
        policyId: filters.policyId,
      });
    }
    if (filters.quotationId) {
      queryBuilder.andWhere('cover_note.quotation_id = :quotationId', {
        quotationId: filters.quotationId,
      });
    }
    return queryBuilder;
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const coverNote = await this.scopedQuery(user)
      .andWhere('cover_note.id = :id', { id })
      .getOne();

    if (!coverNote) {
      throw new NotFoundException('Cover note not found');
    }

    return coverNote;
  }

  /**
   * A cover note is visible exactly when its quotation is: same company,
   * branch, department and own-record rules as the quotations list.
   */
  private scopedQuery(user: AuthenticatedUser) {
    const queryBuilder = this.coverNoteRepository
      .createQueryBuilder('cover_note')
      .innerJoin('cover_note.quotation', 'quotation')
      .where('cover_note.company_id = :coverNoteCompanyId', {
        coverNoteCompanyId: user.companyId,
      });

    this.scopeService.applyQuotationReadScope(
      queryBuilder,
      'quotation',
      this.scopeService.resolve(user),
    );

    return queryBuilder;
  }
}
