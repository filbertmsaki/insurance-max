import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { AuditService } from '../../../shared/audit/audit.service';
import { ProductChannelType } from '../../product-distribution/enums/product-channel-type.enum';
import type { SaveQuotationDraftDto } from '../dto/quotation-draft.dto';
import type { CreateQuotationDto } from '../dto/quotation-payload.dto';

export const SELECT_INSURANCE_CHANNEL_PERMISSION =
  'quotations:select-insurance-channel';

type ChannelUser = Pick<AuthenticatedUser, 'id' | 'permissions'> &
  Partial<
    Pick<
      AuthenticatedUser,
      'companyId' | 'companyMembershipId' | 'activeBranchId' | 'sessionId'
    >
  >;

type ChannelOperation =
  | 'quotation.create'
  | 'quotation.update'
  | 'quotation.draft.create'
  | 'quotation.draft.update'
  | 'policy.create'
  | 'policy.update';

@Injectable()
export class InsuranceChannelPermissionService {
  constructor(private readonly auditService: AuditService) {}

  canSelectInsuranceChannel(
    user: Pick<AuthenticatedUser, 'permissions'> | null | undefined,
  ): boolean {
    return (
      user?.permissions?.includes(SELECT_INSURANCE_CHANNEL_PERMISSION) ?? false
    );
  }

  async authorizeQuotationPayload<T extends CreateQuotationDto>(
    companyId: string,
    payload: T,
    user: ChannelUser,
    operation: ChannelOperation,
    resourceId?: string | null,
  ): Promise<T> {
    if (this.canSelectInsuranceChannel(user)) return payload;

    const requested = payload.internal_quotation.channel_type;
    const requestedIntermediary =
      payload.internal_quotation.intermediary_company_id ?? null;

    if (requested !== ProductChannelType.DIRECT || requestedIntermediary) {
      await this.auditUnauthorizedAttempt({
        companyId,
        user,
        operation,
        resource: 'quotation',
        resourceId,
        requestedChannel: requested,
        requestedIntermediaryCompanyId: requestedIntermediary,
      });

      throw new ForbiddenException(
        'You do not have permission to select Agency, Broker, Bancassurance, or API insurance channels.',
      );
    }

    return {
      ...payload,
      internal_quotation: {
        ...payload.internal_quotation,
        channel_type: ProductChannelType.DIRECT,
        intermediary_company_id: null,
      },
    };
  }

  async authorizeDraftPayload<T extends SaveQuotationDraftDto>(
    companyId: string,
    dto: T,
    user: ChannelUser,
    operation: ChannelOperation,
    resourceId?: string | null,
  ): Promise<T> {
    if (this.canSelectInsuranceChannel(user)) return dto;

    const requested = dto.channel_type;
    const requestedIntermediary = dto.intermediary_company_id ?? null;

    if (requested !== ProductChannelType.DIRECT || requestedIntermediary) {
      await this.auditUnauthorizedAttempt({
        companyId,
        user,
        operation,
        resource: 'quotation',
        resourceId,
        requestedChannel: requested,
        requestedIntermediaryCompanyId: requestedIntermediary,
      });

      throw new ForbiddenException(
        'You do not have permission to select Agency, Broker, Bancassurance, or API insurance channels.',
      );
    }

    const draftPayload = this.normalizeDraftPayload(dto.draft_payload);

    return {
      ...dto,
      channel_type: ProductChannelType.DIRECT,
      intermediary_company_id: null,
      draft_payload: draftPayload,
    };
  }

  async authorizePolicyChannel(
    companyId: string,
    dto: {
      channel_type?: ProductChannelType;
      intermediary_company_id?: string | null;
    },
    user: ChannelUser,
    operation: ChannelOperation,
    resourceId?: string | null,
  ): Promise<void> {
    if (this.canSelectInsuranceChannel(user)) return;

    const requested = dto.channel_type ?? ProductChannelType.DIRECT;
    const requestedIntermediary = dto.intermediary_company_id ?? null;

    if (requested !== ProductChannelType.DIRECT || requestedIntermediary) {
      await this.auditUnauthorizedAttempt({
        companyId,
        user,
        operation,
        resource: 'policy',
        resourceId,
        requestedChannel: requested,
        requestedIntermediaryCompanyId: requestedIntermediary,
      });

      throw new ForbiddenException(
        'You do not have permission to change the policy insurance channel.',
      );
    }
  }

  private normalizeDraftPayload(
    draftPayload: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      ...draftPayload,
      channel_type: ProductChannelType.DIRECT,
      intermediary_company_id: '',
      commission_paid: '',
      commission_rate: '',
    };
  }

  private async auditUnauthorizedAttempt(params: {
    companyId: string;
    user: ChannelUser;
    operation: ChannelOperation;
    resource: 'quotation' | 'policy';
    resourceId?: string | null;
    requestedChannel?: ProductChannelType;
    requestedIntermediaryCompanyId?: string | null;
  }): Promise<void> {
    await this.auditService.logCritical({
      userId: params.user.id,
      companyId: params.companyId,
      companyMembershipId: params.user.companyMembershipId ?? null,
      branchId: params.user.activeBranchId ?? null,
      sessionId: params.user.sessionId ?? null,
      action: 'insurance_channel.unauthorized_change',
      eventCategory: 'authorization',
      resource: params.resource,
      resourceId: params.resourceId ?? undefined,
      status: 'failure',
      reason: 'User lacks permission to select a non-Direct insurance channel.',
      metadata: {
        operation: params.operation,
        requiredPermission: SELECT_INSURANCE_CHANNEL_PERMISSION,
        requestedChannel: params.requestedChannel ?? null,
        requestedIntermediaryCompanyId:
          params.requestedIntermediaryCompanyId ?? null,
      },
    });
  }
}
