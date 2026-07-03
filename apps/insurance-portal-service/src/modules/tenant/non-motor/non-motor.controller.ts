import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { CreateNonMotorPolicyDetailDto } from './dto/create-non-motor-policy-detail.dto';
import { CreateNonMotorQuotationDetailDto } from './dto/create-non-motor-quotation-detail.dto';
import { CreateSubjectMatterFactorValueDto } from './dto/create-subject-matter-factor-value.dto';
import { CreateSubjectMatterDto } from './dto/create-subject-matter.dto';
import { FilterNonMotorDto } from './dto/filter-non-motor.dto';
import { UpdateNonMotorPolicyDetailDto } from './dto/update-non-motor-policy-detail.dto';
import { UpdateNonMotorQuotationDetailDto } from './dto/update-non-motor-quotation-detail.dto';
import { UpdateSubjectMatterDto } from './dto/update-subject-matter.dto';
import { NonMotorService } from './non-motor.service';

@ApiTags('non-motor')
@ApiBearerAuth()
@Controller('tenant/non-motor')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class NonMotorController {
  constructor(private readonly nonMotorService: NonMotorService) {}

  @Get('subject-matters')
  @UseGuards(PermissionsGuard)
  @Permissions('non-motor:read')
  @ApiOperation({ summary: 'List subject matters' })
  listSubjectMatters(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterNonMotorDto,
  ) {
    return this.nonMotorService.listSubjectMatters(user.companyId!, query);
  }

  @Post('subject-matters')
  @UseGuards(PermissionsGuard)
  @Permissions('non-motor:create')
  @ApiOperation({ summary: 'Create a subject matter' })
  createSubjectMatter(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSubjectMatterDto,
  ) {
    return this.nonMotorService.createSubjectMatter(
      user.companyId!,
      dto,
      user.id,
    );
  }

  @Get('subject-matters/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('non-motor:read')
  @ApiOperation({ summary: 'Get a subject matter by ID' })
  findSubjectMatter(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.nonMotorService.findSubjectMatter(user.companyId!, id);
  }

  @Patch('subject-matters/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('non-motor:update')
  @ApiOperation({ summary: 'Update a subject matter' })
  updateSubjectMatter(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubjectMatterDto,
  ) {
    return this.nonMotorService.updateSubjectMatter(
      user.companyId!,
      id,
      dto,
      user.id,
    );
  }

  @Delete('subject-matters/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('non-motor:delete')
  @ApiOperation({ summary: 'Soft-delete a subject matter' })
  async removeSubjectMatter(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.nonMotorService.removeSubjectMatter(user.companyId!, id);
    return { message: 'Subject matter deleted successfully' };
  }

  @Get('subject-matter-factor-values')
  @UseGuards(PermissionsGuard)
  @Permissions('non-motor:read')
  @ApiOperation({ summary: 'List subject matter factor values' })
  listFactorValues(
    @CurrentUser() user: AuthenticatedUser,
    @Query('subject_matter_id') subjectMatterId?: string,
  ) {
    return this.nonMotorService.listFactorValues(
      user.companyId!,
      subjectMatterId,
    );
  }

  @Post('subject-matter-factor-values')
  @UseGuards(PermissionsGuard)
  @Permissions('non-motor:create')
  @ApiOperation({ summary: 'Create a subject matter factor value' })
  createFactorValue(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSubjectMatterFactorValueDto,
  ) {
    return this.nonMotorService.createFactorValue(user.companyId!, dto);
  }

  @Post('quotation-details')
  @UseGuards(PermissionsGuard)
  @Permissions('non-motor:create')
  @ApiOperation({ summary: 'Create a non-motor quotation detail' })
  createQuotationDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateNonMotorQuotationDetailDto,
  ) {
    return this.nonMotorService.createQuotationDetail(user.companyId!, dto);
  }

  @Get('quotation-details')
  @UseGuards(PermissionsGuard)
  @Permissions('non-motor:read')
  @ApiOperation({ summary: 'List non-motor quotation details' })
  listQuotationDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Query('quotation_id') quotationId?: string,
  ) {
    return this.nonMotorService.listQuotationDetails(
      user.companyId!,
      quotationId,
    );
  }

  @Post('policy-details')
  @UseGuards(PermissionsGuard)
  @Permissions('non-motor:create')
  @ApiOperation({ summary: 'Create a non-motor policy detail' })
  createPolicyDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateNonMotorPolicyDetailDto,
  ) {
    return this.nonMotorService.createPolicyDetail(user.companyId!, dto);
  }

  @Get('policy-details')
  @UseGuards(PermissionsGuard)
  @Permissions('non-motor:read')
  @ApiOperation({ summary: 'List non-motor policy details' })
  listPolicyDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Query('policy_id') policyId?: string,
  ) {
    return this.nonMotorService.listPolicyDetails(user.companyId!, policyId);
  }
}
