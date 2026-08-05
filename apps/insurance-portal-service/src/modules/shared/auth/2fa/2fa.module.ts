import { forwardRef, Module } from '@nestjs/common';
import { TwoFaService } from './2fa.service';
import { AuthSecretCryptoService } from './auth-secret-crypto.service';
import { UsersModule } from '../../../tenant/users/users.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule, forwardRef(() => UsersModule)],
  providers: [TwoFaService, AuthSecretCryptoService],
  exports: [TwoFaService],
})
export class TwoFaModule {}
