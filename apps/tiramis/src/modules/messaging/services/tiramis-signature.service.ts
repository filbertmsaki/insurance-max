import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createSign, createVerify } from 'crypto';
import * as forge from 'node-forge';
import { readFileSync } from 'fs';
import { extname } from 'path';

import { resolveTiramisCertificatePath } from '../../config/utils/tiramis-certificate-path.util';

@Injectable()
export class TiramisSignatureService {
  private readonly logger = new Logger(TiramisSignatureService.name);

  signXmlContent(params: {
    contentXml: string;
    privateKeyPfxPath: string;
    privateKeyPfxPassword?: string | null;
  }): string {
    try {
      const contentXml = this.normalizeXmlForSignature(params.contentXml);
      const privateKeyPem = this.loadPrivateKeyFromPfx(
        params.privateKeyPfxPath,
        params.privateKeyPfxPassword,
      );

      const signer = createSign('RSA-SHA1');
      signer.update(contentXml);
      signer.end();

      return signer.sign(
        {
          key: privateKeyPem,
        },
        'base64',
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to sign TIRAMIS XML content: ${error?.message || 'Unknown error'}`,
      );

      throw new BadRequestException(
        'Failed to sign TIRAMIS XML content. Check certificate configuration.',
      );
    }
  }

  verifyXmlContent(params: {
    contentXml: string;
    signature: string;
    publicCertificatePfxPath: string;
    publicCertificatePfxPassword?: string | null;
  }): boolean {
    try {
      const contentXml = this.normalizeXmlForSignature(params.contentXml);
      const publicCertificatePem = this.loadPublicCertificate(
        params.publicCertificatePfxPath,
        params.publicCertificatePfxPassword,
      );

      const verifier = createVerify('RSA-SHA1');
      verifier.update(contentXml);
      verifier.end();

      return verifier.verify(publicCertificatePem, params.signature, 'base64');
    } catch {
      return false;
    }
  }

  removeXmlDeclaration(xml: string): string {
    return xml.replace(/<\?xml.*?\?>/g, '').trim();
  }

  private normalizeXmlForSignature(xml: string): string {
    return this.removeXmlDeclaration(String(xml || ''))
      .replace(/>\s+</g, '><')
      .trim();
  }

  private loadPrivateKeyFromPfx(
    privateKeyPfxPath: string,
    privateKeyPfxPassword?: string | null,
  ): string {
    const resolvedPrivateKeyPfxPath =
      resolveTiramisCertificatePath(privateKeyPfxPath);

    if (
      !resolvedPrivateKeyPfxPath ||
      !this.isPkcs12File(resolvedPrivateKeyPfxPath)
    ) {
      throw new BadRequestException(
        'TIRAMIS private certificate must be a .pfx or .p12 file',
      );
    }

    const pkcs12 = this.loadPkcs12(
      resolvedPrivateKeyPfxPath,
      privateKeyPfxPassword,
    );
    const keyBags =
      pkcs12.getBags({
        bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
      })[forge.pki.oids.pkcs8ShroudedKeyBag] ||
      pkcs12.getBags({
        bagType: forge.pki.oids.keyBag,
      })[forge.pki.oids.keyBag] ||
      [];

    const keyBag = keyBags[0];

    if (!keyBag?.key) {
      throw new BadRequestException(
        'No private key found in TIRAMIS private certificate',
      );
    }

    return forge.pki.privateKeyToPem(keyBag.key);
  }

  private loadPublicCertificateFromPfx(
    publicCertificatePfxPath: string,
    publicCertificatePfxPassword?: string | null,
  ): string {
    const resolvedPublicCertificatePfxPath = resolveTiramisCertificatePath(
      publicCertificatePfxPath,
    );

    if (
      !resolvedPublicCertificatePfxPath ||
      !this.isPkcs12File(resolvedPublicCertificatePfxPath)
    ) {
      throw new BadRequestException(
        'TIRAMIS public certificate must be a .pfx or .p12 file',
      );
    }

    const pkcs12 = this.loadPkcs12(
      resolvedPublicCertificatePfxPath,
      publicCertificatePfxPassword,
    );

    const certBags =
      pkcs12.getBags({
        bagType: forge.pki.oids.certBag,
      })[forge.pki.oids.certBag] || [];

    const certificateBag = certBags[0];

    if (!certificateBag?.cert) {
      throw new BadRequestException(
        'No certificate found in TIRAMIS public certificate',
      );
    }

    return forge.pki.certificateToPem(certificateBag.cert);
  }

  private loadPublicCertificate(
    publicCertificatePath: string,
    publicCertificatePassword?: string | null,
  ): string {
    const resolvedPublicCertificatePath = resolveTiramisCertificatePath(
      publicCertificatePath,
    );

    if (!resolvedPublicCertificatePath) {
      throw new BadRequestException('TIRAMIS public certificate path is missing');
    }

    if (this.isPkcs12File(resolvedPublicCertificatePath)) {
      return this.loadPublicCertificateFromPfx(
        resolvedPublicCertificatePath,
        publicCertificatePassword,
      );
    }

    const extension = extname(resolvedPublicCertificatePath).toLowerCase();

    if (!['.pem', '.cer', '.crt'].includes(extension)) {
      throw new BadRequestException(
        'Unsupported TIRAMIS public certificate file. Use .pfx, .p12, .pem, .cer, or .crt',
      );
    }

    const buffer = readFileSync(resolvedPublicCertificatePath);
    const text = buffer.toString('utf8');

    if (text.includes('BEGIN CERTIFICATE')) {
      return text;
    }

    const der = forge.util.createBuffer(buffer.toString('binary'));
    const asn1 = forge.asn1.fromDer(der);
    const certificate = forge.pki.certificateFromAsn1(asn1);

    return forge.pki.certificateToPem(certificate);
  }

  private loadPkcs12(
    filePath: string,
    password?: string | null,
  ): forge.pkcs12.Pkcs12Pfx {
    try {
      const buffer = readFileSync(filePath);
      const der = forge.util.createBuffer(buffer.toString('binary'));
      const asn1 = forge.asn1.fromDer(der);

      return forge.pkcs12.pkcs12FromAsn1(
        asn1,
        password ? false : undefined,
        password || '',
      );
    } catch (error: any) {
      throw new BadRequestException(
        'Failed to read PKCS#12 certificate file',
      );
    }
  }

  private isPkcs12File(filePath: string): boolean {
    const extension = extname(filePath).toLowerCase();
    return extension === '.pfx' || extension === '.p12';
  }
}
