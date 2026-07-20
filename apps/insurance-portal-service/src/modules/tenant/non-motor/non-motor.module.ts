import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../../platform/companies/entities/company.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Policy } from '../policies/entities/policy.entity';
import { PolicyRisk } from '../policies/entities/policy-risk.entity';
import { RatingFactor } from '../rating-factors/entities/rating-factor.entity';
import { User } from '../users/entities/user.entity';
import { NonMotorController } from './non-motor.controller';
import { NonMotorPolicyDetail } from './entities/non-motor-policy-detail.entity';
import { SubjectMatterFactorValue } from './entities/subject-matter-factor-value.entity';
import { SubjectMatter } from './entities/subject-matter.entity';
import { NonMotorService } from './non-motor.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubjectMatter,
      SubjectMatterFactorValue,
      NonMotorPolicyDetail,
      Company,
      Customer,
      Policy,
      PolicyRisk,
      RatingFactor,
      User,
    ]),
  ],
  controllers: [NonMotorController],
  providers: [NonMotorService],
  exports: [NonMotorService],
})
export class NonMotorModule {}
