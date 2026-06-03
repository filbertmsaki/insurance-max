import { Body, Controller, Get, Post } from '@nestjs/common';

import { CreateTiramisItemDto } from '../dto/create-tiramis-item.dto';
import { TiramisService } from '../services/tiramis.service';

@Controller('tiramis')
export class TiramisController {
  constructor(private readonly tiramisService: TiramisService) {}

  @Get('health')
  getStatus() {
    return this.tiramisService.getStatus();
  }

  @Get('items')
  findAll() {
    return this.tiramisService.findAll();
  }

  @Post('items')
  create(@Body() createDto: CreateTiramisItemDto) {
    return this.tiramisService.create(createDto);
  }
}
