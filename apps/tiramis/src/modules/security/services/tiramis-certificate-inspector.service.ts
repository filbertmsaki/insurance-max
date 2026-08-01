import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as forge from 'node-forge';
import { existsSync, readFileSync } from 'fs';
import { extname } from 'path';

import { resolveTiramisCertificatePath } from '../../config/utils/tiramis-certificate-path.util';

export interface TiramisCertificateInspectionResult {
  path: string;
  fileType: 'PKCS12' | 'PEM' | 'DER';
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  daysUntilExpiry: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
}

@Injectable()
export class TiramisCertificateInspectorService {
  constructor(private readonly configService: ConfigService) {}

  inspectCertificate(params: {
    certificatePath?: string | null;
    password?: string | null;
  }): TiramisCertificateInspectionResult {
    const resolvedPath = resolveTiramisCertificatePath(params.certificatePath);

    if (!resolvedPath) {
      throw new BadRequestException('Certificate path is missing');
    }

    if (!existsSync(resolvedPath)) {
      throw new BadRequestException('Certificate file does not exist');
    }

    const certificate = this.loadCertificate({
      certificatePath: resolvedPath,
      password: params.password,
    });

    const now = new Date();
    const validTo = certificate.validity.notAfter;
    const daysUntilExpiry = Math.ceil(
      (validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    const warningDays = Number(
      this.configService.get<number>(
        'TIRAMIS_CERTIFICATE_EXPIRY_WARNING_DAYS',
      ) ?? 30,
    );

    return {
      path: resolvedPath,
      fileType: this.resolveFileType(resolvedPath),
      subject: this.formatName(certificate.subject),
      issuer: this.formatName(certificate.issuer),
      serialNumber: certificate.serialNumber,
      validFrom: certificate.validity.notBefore.toISOString(),
      validTo: certificate.validity.notAfter.toISOString(),
      daysUntilExpiry,
      isExpired: daysUntilExpiry < 0,
      isExpiringSoon: daysUntilExpiry >= 0 && daysUntilExpiry <= warningDays,
    };
  }

  assertCertificateHealthy(params: {
    certificatePath?: string | null;
    password?: string | null;
    label: string;
  }) {
    const result = this.inspectCertificate({
      certificatePath: params.certificatePath,
      password: params.password,
    });

    if (result.isExpired) {
      throw new BadRequestException(
        `${params.label} certificate has expired on ${result.validTo}`,
      );
    }

    return result;
  }

  private loadCertificate(params: {
    certificatePath: string;
    password?: string | null;
  }): forge.pki.Certificate {
    const extension = extname(params.certificatePath).toLowerCase();

    if (extension === '.pfx' || extension === '.p12') {
      return this.loadCertificateFromPkcs12(
        params.certificatePath,
        params.password,
      );
    }

    if (['.pem', '.cer', '.crt'].includes(extension)) {
      return this.loadCertificateFromPemOrDer(params.certificatePath);
    }

    throw new BadRequestException('Unsupported certificate file type');
  }

  private loadCertificateFromPkcs12(
    certificatePath: string,
    password?: string | null,
  ): forge.pki.Certificate {
    try {
      const buffer = readFileSync(certificatePath);
      const der = forge.util.createBuffer(buffer.toString('binary'));
      const asn1 = forge.asn1.fromDer(der);

      const pkcs12 = forge.pkcs12.pkcs12FromAsn1(
        asn1,
        password ? false : undefined,
        password || '',
      );

      const certBags =
        pkcs12.getBags({
          bagType: forge.pki.oids.certBag,
        })[forge.pki.oids.certBag] || [];

      const certificate = certBags[0]?.cert;

      if (!certificate) {
        throw new Error('No certificate found inside PKCS12 file');
      }

      return certificate;
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to inspect PKCS12 certificate: ${error.message}`,
      );
    }
  }

  private loadCertificateFromPemOrDer(
    certificatePath: string,
  ): forge.pki.Certificate {
    try {
      const buffer = readFileSync(certificatePath);
      const text = buffer.toString('utf8');

      if (text.includes('BEGIN CERTIFICATE')) {
        return forge.pki.certificateFromPem(text);
      }

      const der = forge.util.createBuffer(buffer.toString('binary'));
      const asn1 = forge.asn1.fromDer(der);

      return forge.pki.certificateFromAsn1(asn1);
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to inspect certificate file: ${error.message}`,
      );
    }
  }

  private resolveFileType(path: string): 'PKCS12' | 'PEM' | 'DER' {
    const extension = extname(path).toLowerCase();

    if (extension === '.pfx' || extension === '.p12') {
      return 'PKCS12';
    }

    if (extension === '.pem') {
      return 'PEM';
    }

    return 'DER';
  }

  private formatName(name: any) {
    const fields = Array.isArray(name) ? name : name?.attributes || [];

    return fields
      .map((item: any) => `${item.shortName || item.name}=${item.value}`)
      .join(', ');
  }
}
