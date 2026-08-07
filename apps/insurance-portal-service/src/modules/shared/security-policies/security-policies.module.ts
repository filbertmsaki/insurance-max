import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SecurityPolicyProfile } from './entities/security-policy-profile.entity';
import { SecurityPoliciesService } from './security-policies.service';

@Module({
  imports: [TypeOrmModule.forFeature([SecurityPolicyProfile])],
  providers: [SecurityPoliciesService],
  exports: [SecurityPoliciesService],
})
export class SecurityPoliciesModule {}
