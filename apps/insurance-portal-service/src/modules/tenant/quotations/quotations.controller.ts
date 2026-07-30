import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { FilterQuotationDto } from './dto/filter-quotation.dto';
import {
  CancelQuotationDto,
  SaveQuotationDraftDto,
  UpdateQuotationDraftDto,
} from './dto/quotation-draft.dto';
import {
  CreateQuotationDto,
  UpdateQuotationDto,
  SubmitQuotationDto,
} from './dto/quotation-payload.dto';
import {
  DecideQuotationPremiumOverrideDto,
  RequestQuotationPremiumOverrideDto,
} from './dto/quotation-premium-override.dto';
import { TransitionQuotationStatusDto } from './dto/transition-quotation-status.dto';
import { QuotationsService } from './quotations.service';

@ApiTags('quotations')
@ApiBearerAuth()
@Controller('tenant/quotations')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Post('drafts')
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:create')
  @ApiOperation({
    summary: 'Create a quotation draft',
    description:
      'Saves an incomplete wizard snapshot without full pricing validation, approval, payment, or TIRAMIS submission.',
  })
  @ApiBody({ type: SaveQuotationDraftDto })
  @ApiCreatedResponse({
    description: 'Quotation draft created successfully',
  })
  createDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveQuotationDraftDto,
  ) {
    return this.quotationsService.createDraft(user.companyId!, dto, user.id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:create')
  @ApiOperation({
    summary: 'Create a quotation using the authoritative quotation structure',
    description:
      'Supports NON_MOTOR, MOTOR_SINGLE and MOTOR_FLEET quotation flows.',
  })
  @ApiBody({ type: CreateQuotationDto })
  @ApiCreatedResponse({
    description: 'Quotation created successfully',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQuotationDto,
  ) {
    return this.quotationsService.create(user.companyId!, dto, user);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:read')
  @ApiOperation({
    summary: 'List quotations for the current company',
  })
  @ApiOkResponse({
    description: 'Paginated quotation list',
  })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterQuotationDto,
  ) {
    return this.quotationsService.findAll(user.companyId!, query);
  }

  @Get(':id/payload')
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:read')
  @ApiOperation({
    summary: 'Generate the authoritative quotation payload',
    description:
      'Returns the payload that will be submitted to TIRAMIS without exposing internal database fields.',
  })
  @ApiOkResponse({
    description: 'Authoritative quotation payload',
  })
  getPayload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quotationsService.getAuthoritativePayload(user.companyId!, id);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:read')
  @ApiOperation({
    summary: 'Get a quotation by ID',
  })
  @ApiOkResponse({
    description: 'Quotation retrieved successfully',
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quotationsService.findOne(user.companyId!, id, user);
  }

  @Get(':id/edit')
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:update')
  @ApiOperation({
    summary: 'Get an editable quotation graph',
    description:
      'Returns the complete quotation graph for pre-populating the edit wizard.',
  })
  @ApiOkResponse({
    description: 'Editable quotation retrieved successfully',
  })
  findOneForEdit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quotationsService.findOneForEdit(user.companyId!, id, user);
  }

  @Put(':id/draft')
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:update')
  @ApiOperation({
    summary: 'Update a quotation draft',
    description:
      'Saves the current wizard snapshot and keeps the quotation in DRAFT status.',
  })
  @ApiBody({ type: UpdateQuotationDraftDto })
  @ApiOkResponse({
    description: 'Quotation draft updated successfully',
  })
  updateDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuotationDraftDto,
  ) {
    return this.quotationsService.updateDraft(user.companyId!, id, dto, user.id);
  }

  @Get(':id/preview')
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:read')
  @ApiOperation({
    summary: 'Get a structured quotation preview',
    description:
      'Returns a presentation-friendly quotation preview with related records, totals, payment, TIRAMIS and audit data.',
  })
  @ApiOkResponse({
    description: 'Quotation preview retrieved successfully',
  })
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quotationsService.getPreview(user.companyId!, id, user);
  }

  @Post(':id/risks/:riskId/premium-overrides')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @Permissions('pricing.request_override')
  @ApiOperation({
    summary: 'Request a manual premium override for a quotation risk',
  })
  @ApiBody({ type: RequestQuotationPremiumOverrideDto })
  requestPremiumOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('riskId', ParseUUIDPipe) riskId: string,
    @Body() dto: RequestQuotationPremiumOverrideDto,
  ) {
    return this.quotationsService.requestPremiumOverride(
      user.companyId!,
      id,
      riskId,
      dto,
      user,
    );
  }

  @Post(':id/risks/:riskId/premium-overrides/:overrideId/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @Permissions('pricing.approve_override')
  @ApiOperation({
    summary: 'Approve a manual premium override for a quotation risk',
  })
  @ApiBody({ type: DecideQuotationPremiumOverrideDto, required: false })
  approvePremiumOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('riskId', ParseUUIDPipe) riskId: string,
    @Param('overrideId', ParseUUIDPipe) overrideId: string,
    @Body() dto: DecideQuotationPremiumOverrideDto = {},
  ) {
    return this.quotationsService.approvePremiumOverride(
      user.companyId!,
      id,
      riskId,
      overrideId,
      dto,
      user,
    );
  }

  @Post(':id/risks/:riskId/premium-overrides/:overrideId/reject')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @Permissions('pricing.approve_override')
  @ApiOperation({
    summary: 'Reject a manual premium override for a quotation risk',
  })
  @ApiBody({ type: DecideQuotationPremiumOverrideDto })
  rejectPremiumOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('riskId', ParseUUIDPipe) riskId: string,
    @Param('overrideId', ParseUUIDPipe) overrideId: string,
    @Body() dto: DecideQuotationPremiumOverrideDto,
  ) {
    return this.quotationsService.rejectPremiumOverride(
      user.companyId!,
      id,
      riskId,
      overrideId,
      dto,
      user,
    );
  }

  @Put(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:update')
  @ApiOperation({
    summary: 'Replace an existing quotation',
    description:
      'Replaces the complete unsubmitted quotation aggregate and returns it to DRAFT status.',
  })
  @ApiBody({ type: CreateQuotationDto })
  @ApiOkResponse({
    description: 'Quotation replaced successfully',
  })
  replace(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuotationDto,
  ) {
    return this.quotationsService.replace(user.companyId!, id, dto, user);
  }

  @Post(':id/finalize')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:update')
  @ApiOperation({
    summary: 'Complete a quotation',
    description:
      'Performs full validation, refreshes authoritative pricing, saves the final quotation snapshot, and determines approval and payment requirements.',
  })
  @ApiBody({ type: UpdateQuotationDto })
  @ApiOkResponse({
    description: 'Quotation finalized successfully',
  })
  finalize(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuotationDto,
  ) {
    return this.quotationsService.finalize(user.companyId!, id, dto, user);
  }

  @Post(':id/submit-for-approval')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:update')
  @ApiOperation({
    summary: 'Submit a completed quotation for approval',
  })
  @ApiOkResponse({
    description: 'Quotation submitted for approval successfully',
  })
  submitForApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quotationsService.submitForApprovalAction(
      user.companyId!,
      id,
      user.id,
    );
  }

  @Post(':id/request-payment')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:update')
  @ApiOperation({
    summary: 'Create a quotation payment request',
  })
  @ApiOkResponse({
    description: 'Quotation payment request created successfully',
  })
  requestPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quotationsService.requestPayment(user.companyId!, id, user.id);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:submit')
  @ApiOperation({
    summary: 'Submit a quotation to TIRAMIS',
    description:
      'Reconstructs and validates the authoritative payload, verifies payment and submits it to TIRAMIS.',
  })
  @ApiBody({
    type: SubmitQuotationDto,
    required: false,
  })
  @ApiOkResponse({
    description: 'Quotation submitted successfully',
  })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitQuotationDto = {},
  ) {
    return this.quotationsService.submit(user.companyId!, id, dto, user);
  }

  @Post(':id/retry-tira')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:submit')
  @ApiOperation({
    summary: 'Retry a failed TIRAMIS submission',
  })
  @ApiOkResponse({
    description: 'Quotation resubmitted to TIRAMIS successfully',
  })
  retryTira(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quotationsService.retryTiraSubmission(
      user.companyId!,
      id,
      user,
    );
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:update')
  @ApiOperation({
    summary: 'Cancel a quotation',
  })
  @ApiBody({ type: CancelQuotationDto })
  @ApiOkResponse({
    description: 'Quotation cancelled successfully',
  })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelQuotationDto,
  ) {
    return this.quotationsService.cancelQuotationAction(
      user.companyId!,
      id,
      dto.cancellation_reason,
      user.id,
    );
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:update')
  @ApiOperation({
    summary: 'Transition a quotation status',
    description:
      'Applies the quotation lifecycle transition matrix and records audit history.',
  })
  @ApiBody({ type: TransitionQuotationStatusDto })
  @ApiOkResponse({
    description: 'Quotation status updated successfully',
  })
  transitionStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionQuotationStatusDto,
  ) {
    return this.quotationsService.transitionStatus(
      user.companyId!,
      id,
      dto,
      user.id,
    );
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:delete')
  @ApiOperation({
    summary: 'Delete an unsubmitted draft quotation',
  })
  @ApiOkResponse({
    description: 'Quotation deleted successfully',
  })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.quotationsService.remove(user.companyId!, id);

    return {
      message: 'Quotation deleted successfully',
    };
  }

  @Delete(':id/draft')
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:delete')
  @ApiOperation({
    summary: 'Delete an unsubmitted quotation draft',
  })
  @ApiOkResponse({
    description: 'Quotation draft deleted successfully',
  })
  async removeDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.quotationsService.removeDraft(user.companyId!, id);

    return {
      message: 'Quotation draft deleted successfully',
    };
  }
}
