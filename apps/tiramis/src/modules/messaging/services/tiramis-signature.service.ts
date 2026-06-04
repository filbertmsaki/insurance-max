import { BadRequestException, Injectable } from '@nestjs/common';
import { createSign, createVerify } from 'crypto';
import * as forge from 'node-forge';
import { readFileSync } from 'fs';
import { extname } from 'path';

@Injectable()
export class TiramisSignatureService {
  signXmlContent(params: {
    contentXml: string;
    privateKeyPfxPath: string;
    privateKeyPfxPassword?: string | null;
  }): string {
    try {
      const privateKeyPem = this.loadPrivateKeyFromPfx(
        params.privateKeyPfxPath,
        params.privateKeyPfxPassword,
      );

      const signer = createSign('RSA-SHA1');
      signer.update(params.contentXml);
      signer.end();

      return signer.sign(
        {
          key: privateKeyPem,
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
    publicCertificatePfxPath: string;
    publicCertificatePfxPassword?: string | null;
  }): boolean {
    try {
      const publicCertificatePem = this.loadPublicCertificateFromPfx(
        params.publicCertificatePfxPath,
        params.publicCertificatePfxPassword,
      );

      const verifier = createVerify('RSA-SHA1');
      verifier.update(params.contentXml);
      verifier.end();

      return verifier.verify(publicCertificatePem, params.signature, 'base64');
    } catch {
      return false;
    }
  }

  removeXmlDeclaration(xml: string): string {
    return xml.replace(/<\?xml.*?\?>/g, '').trim();
  }

  private loadPrivateKeyFromPfx(
    privateKeyPfxPath: string,
    privateKeyPfxPassword?: string | null,
  ): string {
    if (!this.isPkcs12File(privateKeyPfxPath)) {
      throw new BadRequestException(
        `TIRAMIS private PFX must be a .pfx or .p12 file: ${privateKeyPfxPath}`,
      );
    }

    const pkcs12 = this.loadPkcs12(privateKeyPfxPath, privateKeyPfxPassword);
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
        `No private key found in TIRAMIS private PFX: ${privateKeyPfxPath}`,
      );
    }

    return forge.pki.privateKeyToPem(keyBag.key);
  }

  private loadPublicCertificateFromPfx(
    publicCertificatePfxPath: string,
    publicCertificatePfxPassword?: string | null,
  ): string {
    if (!this.isPkcs12File(publicCertificatePfxPath)) {
      throw new BadRequestException(
        `TIRAMIS public PFX must be a .pfx or .p12 file: ${publicCertificatePfxPath}`,
      );
    }

    const pkcs12 = this.loadPkcs12(
      publicCertificatePfxPath,
      publicCertificatePfxPassword,
    );

    const certBags =
      pkcs12.getBags({
        bagType: forge.pki.oids.certBag,
      })[forge.pki.oids.certBag] || [];

    const certificateBag = certBags[0];

    if (!certificateBag?.cert) {
      throw new BadRequestException(
        `No certificate found in TIRAMIS public PFX: ${publicCertificatePfxPath}`,
      );
    }

    return forge.pki.certificateToPem(certificateBag.cert);
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
        `Failed to read PKCS#12 file "${filePath}": ${error.message}`,
      );
    }
  }

  private isPkcs12File(filePath: string): boolean {
    const extension = extname(filePath).toLowerCase();
    return extension === '.pfx' || extension === '.p12';
  }
}
