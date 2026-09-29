import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { UnderwriteAction, UnderwriteLine } from '@insurance-max/contracts';
import { TenantScoped } from '@insurance-max/portal-shared';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  CurrentUnderwriteLine,
  UnderwriteLineAccess,
} from '../common/underwrite-line.access';
import { UnderwriteLineGuard } from '../common/underwrite-line.guard';
import { UnderwriteQueryService } from '../common/underwrite-query.service';
import { UnderwriteQuotationCommandService } from '../common/underwrite-quotation-command.service';
import {
  CreateRiskFieldDto,
  ListRiskFieldsQueryDto,
  SaveRiskDetailsDto,
  UpdateRiskFieldDto,
} from './dto/non-motor-risk.dto';
import { NonMotorRiskService } from './non-motor-risk.service';

const NON_MOTOR_PARAM = {
  name: 'line',
  enum: ['non-motor'],
  description: 'Non-Motor line only',
};

/**
 * Non-Motor-only endpoints: product risk schemas, quotation risk details and
 * documents. Schema changes need the product-configuration permission as
 * well as the Non-Motor gate.
 */
@ApiTags('underwrite')
@ApiBearerAuth()
@Controller('tenant/underwrite/:line')
@TenantScoped()
@UseGuards(UnderwriteLineGuard)
export class UnderwriteNonMotorController {
  constructor(
    private readonly risks: NonMotorRiskService,
    private readonly queryService: UnderwriteQueryService,
    private readonly commands: UnderwriteQuotationCommandService,
  ) {}

  @Get('risk-schemas')
  @Permissions('quotations:read')
  @UnderwriteLineAccess(UnderwriteAction.VIEW)
  @ApiParam(NON_MOTOR_PARAM)
  @ApiOperation({ summary: 'Risk fields of a non-motor product' })
  listFields(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Query() query: ListRiskFieldsQueryDto,
  ) {
    this.assertNonMotor(line);
    return this.risks.listFields(
      user.companyId!,
      query.product_id,
      query.sub_class_id,
      query.include_inactive === 'true',
    );
  }

  @Post('risk-schemas')
  @Permissions('insurance-products:update')
  @UnderwriteLineAccess(UnderwriteAction.EDIT)
  @ApiParam(NON_MOTOR_PARAM)
  @ApiOperation({ summary: 'Add a risk field to a non-motor product' })
  createField(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Body() dto: CreateRiskFieldDto,
  ) {
    this.assertNonMotor(line);
    return this.risks.createField(user, dto);
  }

  @Patch('risk-schemas/:fieldId')
  @Permissions('insurance-products:update')
  @UnderwriteLineAccess(UnderwriteAction.EDIT)
  @ApiParam(NON_MOTOR_PARAM)
  @ApiOperation({ summary: 'Change a risk field' })
  updateField(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Body() dto: UpdateRiskFieldDto,
  ) {
    this.assertNonMotor(line);
    return this.risks.updateField(user, fieldId, dto);
  }

  @Delete('risk-schemas/:fieldId')
  @Permissions('insurance-products:update')
  @UnderwriteLineAccess(UnderwriteAction.EDIT)
  @ApiParam(NON_MOTOR_PARAM)
  @ApiOperation({ summary: 'Remove a risk field' })
  removeField(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
  ) {
    this.assertNonMotor(line);
    return this.risks.removeField(user, fieldId);
  }

  @Get('quotations/:id/risk-details')
  @Permissions('quotations:read')
  @UnderwriteLineAccess(UnderwriteAction.VIEW)
  @ApiParam(NON_MOTOR_PARAM)
  @ApiOperation({ summary: 'Risk details captured for a quotation' })
  async getRiskDetails(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.assertNonMotor(line);
    await this.queryService.getQuotation(user, line, id);
    return this.risks.getQuotationDetails(user.companyId!, id);
  }

  @Put('quotations/:id/risk-details')
  @Permissions('quotations:update')
  @UnderwriteLineAccess(UnderwriteAction.EDIT)
  @ApiParam(NON_MOTOR_PARAM)
  @ApiOperation({ summary: 'Save risk details for a draft quotation' })
  async saveRiskDetails(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveRiskDetailsDto,
  ) {
    this.assertNonMotor(line);
    // Same write-access and editable-status rules as the wizard's edit load.
    await this.commands.getForEdit(user, line, id);
    return this.risks.saveQuotationDetails(user, id, dto);
  }

  @Get('quotations/:id/documents')
  @Permissions('quotations:read')
  @UnderwriteLineAccess(UnderwriteAction.VIEW)
  @ApiParam(NON_MOTOR_PARAM)
  @ApiOperation({ summary: 'Documents attached to a quotation' })
  async listDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.assertNonMotor(line);
    await this.queryService.getQuotation(user, line, id);
    return this.risks.listQuotationDocuments(user.companyId!, id);
  }

  @Get('policies/:id/risk-details')
  @Permissions('policies:read')
  @UnderwriteLineAccess(UnderwriteAction.POLICIES_VIEW)
  @ApiParam(NON_MOTOR_PARAM)
  @ApiOperation({ summary: 'Risk details of a non-motor policy' })
  async getPolicyRiskDetails(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.assertNonMotor(line);
    await this.queryService.getPolicy(user, line, id);
    return this.risks.getPolicyDetails(user.companyId!, id);
  }

  private assertNonMotor(line: UnderwriteLine) {
    if (line !== UnderwriteLine.NON_MOTOR) {
      throw new NotFoundException();
    }
  }
}
