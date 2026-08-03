import { Global, Module } from '@nestjs/common';

import { DataAccessScopeService } from './data-access-scope.service';

@Global()
@Module({
  providers: [DataAccessScopeService],
  exports: [DataAccessScopeService],
})
export class AuthorizationModule {}
