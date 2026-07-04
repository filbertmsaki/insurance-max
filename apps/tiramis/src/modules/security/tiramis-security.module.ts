import { Module } from '@nestjs/common';

import { TiramisCertificateInspectorService } from './services/tiramis-certificate-inspector.service';
import { TiramisSecretCryptoService } from './services/tiramis-secret-crypto.service';

@Module({
  providers: [TiramisSecretCryptoService, TiramisCertificateInspectorService],
  exports: [TiramisSecretCryptoService, TiramisCertificateInspectorService],
})
export class TiramisSecurityModule {}
