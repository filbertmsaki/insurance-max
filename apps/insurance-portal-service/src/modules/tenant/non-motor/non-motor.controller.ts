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
  } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { CreateNonMotorPolicyDetailDto } from './dto/create-non-motor-policy-detail.dto';
import { CreateSubjectMatterFactorValueDto } from './dto/create-subject-matter-factor-value.dto';
import { CreateSubjectMatterDto } from './dto/create-subject-matter.dto';
import { FilterNonMotorDto } from './dto/filter-non-motor.dto';
import { UpdateNonMotorPolicyDetailDto } from './dto/update-non-motor-policy-detail.dto';
import { UpdateSubjectMatterDto } from './dto/update-subject-matter.dto';
import { NonMotorService } from './non-motor.service';
import { TenantScoped } from '@insurance-max/portal-shared';

@ApiTags('non-motor')
@ApiBearerAuth()
@Controller('tenant/non-motor')
@TenantScoped()
export class NonMotorController {
  constructor(private readonly nonMotorService: NonMotorService) {}

  @Get('subject-matters')
  @Permissions('non-motor:read')
  @ApiOperation({ summary: 'List subject matters' })
  listSubjectMatters(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterNonMotorDto,
  ) {
    return this.nonMotorService.listSubjectMatters(user.companyId!, query);
  }

  @Post('subject-matters')
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
  @Permissions('non-motor:read')
  @ApiOperation({ summary: 'Get a subject matter by ID' })
  findSubjectMatter(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.nonMotorService.findSubjectMatter(user.companyId!, id);
  }

  @Patch('subject-matters/:id')
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
  @Permissions('non-motor:create')
  @ApiOperation({ summary: 'Create a subject matter factor value' })
  createFactorValue(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSubjectMatterFactorValueDto,
  ) {
    return this.nonMotorService.createFactorValue(user.companyId!, dto);
  }

  @Post('policy-details')
  @Permissions('non-motor:create')
  @ApiOperation({ summary: 'Create a non-motor policy detail' })
  createPolicyDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateNonMotorPolicyDetailDto,
  ) {
    return this.nonMotorService.createPolicyDetail(user.companyId!, dto);
  }

  @Get('policy-details')
  @Permissions('non-motor:read')
  @ApiOperation({ summary: 'List non-motor policy details' })
  listPolicyDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Query('policy_id') policyId?: string,
  ) {
    return this.nonMotorService.listPolicyDetails(user.companyId!, policyId);
  }
}
