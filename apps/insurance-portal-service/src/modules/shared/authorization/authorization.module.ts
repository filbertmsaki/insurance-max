import { Global, Module } from '@nestjs/common';

import { DataAccessScopeService } from './data-access-scope.service';
import { AuthorizationVersionService } from './authorization-version.service';

@Global()
@Module({
  providers: [DataAccessScopeService, AuthorizationVersionService],
  exports: [DataAccessScopeService, AuthorizationVersionService],
})
export class AuthorizationModule {}
