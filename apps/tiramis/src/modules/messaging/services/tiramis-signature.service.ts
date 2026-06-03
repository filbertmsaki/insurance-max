import { BadRequestException, Injectable } from '@nestjs/common';
import { createSign, createVerify } from 'crypto';
import { readFileSync } from 'fs';

@Injectable()
export class TiramisSignatureService {
  signXmlContent(params: {
    contentXml: string;
    privateKeyPath: string;
    privateKeyPassword?: string | null;
  }): string {
    try {
      const privateKey = readFileSync(params.privateKeyPath, 'utf8');

      const signer = createSign('RSA-SHA1');
      signer.update(params.contentXml);
      signer.end();

      return signer.sign(
        {
          key: privateKey,
          passphrase: params.privateKeyPassword || undefined,
        },
        'base64',
      );
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to sign TIRAMIS XML content: ${error.message}`,
      );
    }
  }

  verifyXmlContent(params: {
    contentXml: string;
    signature: string;
    publicCertificatePath: string;
  }): boolean {
    try {
      const publicCertificate = readFileSync(
        params.publicCertificatePath,
        'utf8',
      );

      const verifier = createVerify('RSA-SHA1');
      verifier.update(params.contentXml);
      verifier.end();

      return verifier.verify(publicCertificate, params.signature, 'base64');
    } catch {
      return false;
    }
  }

  removeXmlDeclaration(xml: string): string {
    return xml.replace(/<\?xml.*?\?>/g, '').trim();
  }
}
