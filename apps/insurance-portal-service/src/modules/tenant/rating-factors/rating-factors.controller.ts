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
import { RatingFactorsService } from './rating-factors.service';
import { CreateRatingFactorDto } from './dto/create-rating-factor.dto';
import { UpdateRatingFactorDto } from './dto/update-rating-factor.dto';
import { FilterRatingFactorDto } from './dto/filter-rating-factor.dto';
import { TenantScoped } from '@insurance-max/portal-shared';

@ApiTags('Rating Factors')
@ApiBearerAuth()
@Controller('rating-factors')
@TenantScoped()
export class RatingFactorsController {
  constructor(private readonly service: RatingFactorsService) {}

  @Get()
  @Permissions('rating-factors:read')
  @ApiOperation({ summary: 'List all rating factors for the current company' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterRatingFactorDto,
  ) {
    return this.service.findAll(user.companyId!, query);
  }

  @Post()
  @Permissions('rating-factors:create')
  @ApiOperation({
    summary: 'Create a new rating factor (e.g. sum_insured, vehicle_age)',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRatingFactorDto,
  ) {
    return this.service.create(user.companyId!, dto, user.id);
  }

  @Get(':factorId')
  @Permissions('rating-factors:read')
  @ApiOperation({ summary: 'Get a rating factor by ID' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('factorId', ParseUUIDPipe) factorId: string,
  ) {
    return this.service.findOne(user.companyId!, factorId);
  }

  @Patch(':factorId')
  @Permissions('rating-factors:update')
  @ApiOperation({ summary: 'Update a rating factor' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('factorId', ParseUUIDPipe) factorId: string,
    @Body() dto: UpdateRatingFactorDto,
  ) {
    return this.service.update(user.companyId!, factorId, dto, user.id);
  }

  @Delete(':factorId')
  @Permissions('rating-factors:delete')
  @ApiOperation({ summary: 'Soft-delete a rating factor' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('factorId', ParseUUIDPipe) factorId: string,
  ) {
    await this.service.remove(user.companyId!, factorId);
    return { message: 'Rating factor deleted successfully' };
  }
}
