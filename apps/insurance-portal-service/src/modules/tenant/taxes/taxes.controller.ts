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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantScoped } from '@insurance-max/portal-shared';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { TaxesService } from './taxes.service';
import { CreateTaxDto, UpdateTaxDto } from './dto/tax.dto';
import { FindTaxesQueryDto } from './dto/find-taxes-query.dto';
import { isPagedRequest } from '@insurance-max/portal-shared/dto/table-query.dto';

@ApiTags('Taxes')
@ApiBearerAuth()
@Controller('taxes')
@TenantScoped()
export class TaxesController {
  constructor(private readonly service: TaxesService) {}

  @Get('active')
  @Permissions('pricing.calculate')
  active(@CurrentUser() user: AuthenticatedUser) {
    return this.service.list(user.companyId!, true);
  }

  @Get('default')
  @Permissions('pricing.calculate')
  default(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getDefault(user.companyId!);
  }

  @Get()
  @Permissions('product-distribution:read')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FindTaxesQueryDto,
  ) {
    return isPagedRequest(query)
      ? this.service.findPage(user.companyId!, query)
      : this.service.list(user.companyId!);
  }

  @Get(':id')
  @Permissions('product-distribution:read')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(user.companyId!, id);
  }

  @Post()
  @Permissions('product-distribution:create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTaxDto) {
    return this.service.create(user.companyId!, dto);
  }

  @Patch(':id')
  @Permissions('product-distribution:update')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaxDto,
  ) {
    return this.service.update(user.companyId!, id, dto);
  }

  @Delete(':id')
  @Permissions('product-distribution:delete')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(user.companyId!, id);
  }
}
