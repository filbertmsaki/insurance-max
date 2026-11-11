import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MOTOR_INSURANCE_CUTOVER,
  MOTOR_INSURANCE_LINES,
  MOTOR_INSURANCE_PREVIEW_PERMISSION,
  type MotorInsuranceLine,
  UnderwriteAction,
  type UnderwriteActionValue,
  quotationFlowForUnderwriteLine,
  underwriteLineEntryPermissions,
  underwriteLineFromQuotationFlow,
  underwritePermissionsGranting,
} from '@insurance-max/contracts';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { FilterPolicyDto } from '../../policies/dto/filter-policy.dto';
import { FilterQuotationDto } from '../../quotations/dto/filter-quotation.dto';
import { QuotationFlow } from '../../quotations/enums/quotation-flow.enum';
import { UnderwriteQueryService } from './underwrite-query.service';
import { userHasPermission } from './underwrite-line.access';

export type MotorInsuranceType = 'single' | 'fleet';

const TYPE_TO_LINE: Record<MotorInsuranceType, MotorInsuranceLine> = {
  single: 'MOTOR',
  fleet: 'FLEET',
};

/**
 * Reads for the unified Motor Insurance module (MF-1).
 *
 * The combined lists only include the lines (Motor, Fleet) for which the user
 * holds the line gate, and then delegate to the same `*ForUser` services as
 * the per-line screens, so company/branch/department/own-record data scope is
 * applied unchanged. A user never sees more here than in the old menus.
 */
@Injectable()
export class MotorInsuranceQueryService {
  /** MF-7 switch; overridable in tests to cover both modes. */
  cutover: boolean = MOTOR_INSURANCE_CUTOVER;

  constructor(private readonly underwriteQuery: UnderwriteQueryService) {}

  /** Motor-insurance lines the user may access for `action`. */
  permittedLines(
    user: AuthenticatedUser,
    action: UnderwriteActionValue,
  ): MotorInsuranceLine[] {
    this.assertPreview(user);
    // Quotation and policy reads are filtered by cover in the data scope, so
    // restricted-cover holders (Short-Term) may enter them. Policy
    // transactions and TIRA queues stay line-only.
    const coverFiltered =
      action === UnderwriteAction.VIEW ||
      action === UnderwriteAction.POLICIES_VIEW;
    const lines = MOTOR_INSURANCE_LINES.filter((line) =>
      (coverFiltered
        ? underwriteLineEntryPermissions(line, action)
        : underwritePermissionsGranting(line, action)
      ).some((permission) => userHasPermission(user, permission)),
    );
    if (lines.length === 0) {
      throw new ForbiddenException({
        code: 'MISSING_REQUIRED_PERMISSION',
        message: 'You do not have access to Motor or Fleet.',
      });
    }
    return lines;
  }

  listQuotations(
    user: AuthenticatedUser,
    query: FilterQuotationDto,
    type?: MotorInsuranceType,
  ) {
    const lines = this.narrow(
      this.permittedLines(user, UnderwriteAction.VIEW),
      type,
    );
    return this.underwriteQuery.listQuotationsForFlows(
      user,
      lines.map(
        (line) => quotationFlowForUnderwriteLine(line) as QuotationFlow,
      ),
      query,
    );
  }

  listPolicies(
    user: AuthenticatedUser,
    query: FilterPolicyDto,
    type?: MotorInsuranceType,
  ) {
    const lines = this.narrow(
      this.permittedLines(user, UnderwriteAction.POLICIES_VIEW),
      type,
    );
    return this.underwriteQuery.listPoliciesForLines(user, lines, query);
  }

  /** Which line a quotation belongs to, after the read scope check. */
  async resolveQuotationLine(user: AuthenticatedUser, id: string) {
    const lines = this.permittedLines(user, UnderwriteAction.VIEW);
    const flow = await this.underwriteQuery.getQuotationFlowForUser(user, id);
    const line = underwriteLineFromQuotationFlow(flow);
    if (!line || !(lines as string[]).includes(line)) {
      throw new NotFoundException('Quotation not found');
    }
    return { id, line };
  }

  /** Which line a policy belongs to, after the read scope check. */
  async resolvePolicyLine(user: AuthenticatedUser, id: string) {
    const lines = this.permittedLines(user, UnderwriteAction.POLICIES_VIEW);
    const line = await this.underwriteQuery.getPolicyLineForUser(user, id);
    if (!line || !(lines as string[]).includes(line)) {
      throw new NotFoundException('Policy not found');
    }
    return { id, line };
  }

  private narrow(
    lines: MotorInsuranceLine[],
    type?: MotorInsuranceType,
  ): MotorInsuranceLine[] {
    if (!type) return lines;
    const wanted = TYPE_TO_LINE[type];
    return lines.filter((line) => line === wanted);
  }

  /**
   * Pilot gate. After the MF-7 cutover every Motor/Fleet user may use the
   * module; the line gates and data scope above still apply in full.
   */
  private assertPreview(user: AuthenticatedUser) {
    if (this.cutover) return;
    if (!userHasPermission(user, MOTOR_INSURANCE_PREVIEW_PERMISSION)) {
      throw new ForbiddenException({
        code: 'MISSING_REQUIRED_PERMISSION',
        message: 'The Motor Insurance pilot is not enabled for you.',
        details: {
          required: [MOTOR_INSURANCE_PREVIEW_PERMISSION],
          missing: [MOTOR_INSURANCE_PREVIEW_PERMISSION],
        },
      });
    }
  }
}
