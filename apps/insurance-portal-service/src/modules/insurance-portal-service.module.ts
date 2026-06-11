import { Module } from '@nestjs/common';

import { PlatformModule } from './platform/platform.module';
import { SharedModule } from './shared/shared.module';
import { TenantModule } from './tenant/tenant.module';

@Module({
  imports: [SharedModule, PlatformModule, TenantModule],
})
export class InsurancePortalServiceModule {}
