import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SecurityPolicyProfile } from './entities/security-policy-profile.entity';
import { SecurityPoliciesService } from './security-policies.service';
import { SecurityPolicyAdminService } from './security-policy-admin.service';
import { SecurityPolicyController } from './security-policy.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SecurityPolicyProfile])],
  controllers: [SecurityPolicyController],
  providers: [SecurityPoliciesService, SecurityPolicyAdminService],
  exports: [SecurityPoliciesService],
})
export class SecurityPoliciesModule {}
