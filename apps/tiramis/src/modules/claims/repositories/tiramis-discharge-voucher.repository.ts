import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TiramisDischargeVoucherEntity } from '../entities/tiramis-discharge-voucher.entity';

@Injectable()
export class TiramisDischargeVoucherRepository {
  constructor(
    @InjectRepository(TiramisDischargeVoucherEntity)
    private readonly repository: Repository<TiramisDischargeVoucherEntity>,
  ) {}

  create(data: Partial<TiramisDischargeVoucherEntity>) {
    return this.repository.create(data);
  }

  save(dischargeVoucher: TiramisDischargeVoucherEntity) {
    return this.repository.save(dischargeVoucher);
  }

  findById(id: string) {
    return this.repository.findOne({
      where: { id },
    });
  }

  findByRequestId(requestId: string) {
    return this.repository.findOne({
      where: { requestId },
    });
  }

  findByDischargeVoucherNumber(dischargeVoucherNumber: string) {
    return this.repository.findOne({
      where: { dischargeVoucherNumber },
    });
  }
}
