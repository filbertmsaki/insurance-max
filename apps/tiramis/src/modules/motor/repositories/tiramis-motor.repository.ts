import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TiramisMotorDetailEntity } from '../entities/tiramis-motor-detail.entity';
import { TiramisMotorFleetItemEntity } from '../entities/tiramis-motor-fleet-item.entity';
import { TiramisMotorFleetEntity } from '../entities/tiramis-motor-fleet.entity';

@Injectable()
export class TiramisMotorRepository {
  constructor(
    @InjectRepository(TiramisMotorFleetEntity)
    private readonly fleetRepository: Repository<TiramisMotorFleetEntity>,
    @InjectRepository(TiramisMotorFleetItemEntity)
    private readonly fleetItemRepository: Repository<TiramisMotorFleetItemEntity>,
    @InjectRepository(TiramisMotorDetailEntity)
    private readonly motorDetailRepository: Repository<TiramisMotorDetailEntity>,
  ) {}

  createFleet(data: Partial<TiramisMotorFleetEntity>) {
    return this.fleetRepository.create(data);
  }

  saveFleet(entity: TiramisMotorFleetEntity) {
    return this.fleetRepository.save(entity);
  }

  createFleetItem(data: Partial<TiramisMotorFleetItemEntity>) {
    return this.fleetItemRepository.create(data);
  }

  saveFleetItem(entity: TiramisMotorFleetItemEntity) {
    return this.fleetItemRepository.save(entity);
  }

  createMotorDetail(data: Partial<TiramisMotorDetailEntity>) {
    return this.motorDetailRepository.create(data);
  }

  saveMotorDetail(entity: TiramisMotorDetailEntity) {
    return this.motorDetailRepository.save(entity);
  }

  findMotorDetailByRegistrationNumber(registrationNumber: string) {
    return this.motorDetailRepository.findOne({
      where: { registrationNumber },
    });
  }

  findMotorDetailByChassisNumber(chassisNumber: string) {
    return this.motorDetailRepository.findOne({
      where: { chassisNumber },
    });
  }

  findFleetByCoverNoteId(coverNoteId: string) {
    return this.fleetRepository.findOne({
      where: { coverNoteId },
      relations: {
        items: {
          motorDetails: true,
        },
      },
    });
  }

  findMotorDetailsByCoverNoteId(coverNoteId: string) {
    return this.motorDetailRepository.find({
      where: { coverNoteId },
    });
  }
}
