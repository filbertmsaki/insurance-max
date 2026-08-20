import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
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
    const query = this.fleetRepository
      .createQueryBuilder('fleet')
      .innerJoin('fleet.coverNote', 'coverNote')
      .leftJoinAndSelect('fleet.items', 'items')
      .leftJoinAndSelect('items.motorDetails', 'motorDetails')
      .where(
        '(coverNote.coverNoteNumber = :coverNoteId OR coverNote.coverNoteReferenceNumber = :coverNoteId)',
        { coverNoteId },
      );

    if (isUUID(coverNoteId)) {
      query.orWhere('coverNote.id = :coverNoteId', { coverNoteId });
    }

    return query.getOne();
  }

  findMotorDetailsByCoverNoteId(coverNoteId: string) {
    const query = this.motorDetailRepository
      .createQueryBuilder('motorDetail')
      .innerJoin('motorDetail.coverNote', 'coverNote')
      .where(
        '(coverNote.coverNoteNumber = :coverNoteId OR coverNote.coverNoteReferenceNumber = :coverNoteId)',
        { coverNoteId },
      );

    if (isUUID(coverNoteId)) {
      query.orWhere('coverNote.id = :coverNoteId', { coverNoteId });
    }

    return query.getMany();
  }
}
