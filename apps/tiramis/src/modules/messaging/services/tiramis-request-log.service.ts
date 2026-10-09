import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { appendFile, mkdir } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class TiramisRequestLogService {
  private readonly logger = new Logger(TiramisRequestLogService.name);
  private readonly pendingWrites = new Map<string, Promise<void>>();

  constructor(private readonly configService: ConfigService) {}

  async append(
    requestId: string,
    entry: Record<string, unknown>,
  ): Promise<void> {
    if (
      !this.configService.get<boolean>('tiramisService.requestLogEnabled', true)
    ) {
      return;
    }

    const sanitizedEntry = this.sanitizeEntry(entry);

    // Keep ordinary TIRA IDs readable; hash unsafe/oversized IDs rather than
    // replacing characters, which could merge distinct requests into one file.
    const safeId =
      /^[a-zA-Z0-9_-]{1,120}$/.test(requestId) &&
      !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(requestId)
        ? requestId
        : `request-${createHash('sha256').update(requestId).digest('hex')}`;
    const directory =
      this.configService.get<string>('tiramisService.requestLogDir') ||
      join(process.cwd(), 'logs', 'tira-requests');
    const filename = join(directory, `${safeId}.log`);

    // Serialize writes to each file, including concurrent callbacks/replays.
    const write = (this.pendingWrites.get(filename) || Promise.resolve()).then(
      async () => {
        try {
          await mkdir(directory, { recursive: true, mode: 0o750 });
          await appendFile(
            filename,
            `${JSON.stringify({ ...sanitizedEntry, timestamp: new Date().toISOString(), requestId })}\n`,
            { encoding: 'utf8', mode: 0o600 },
          );
        } catch (error: unknown) {
          // Disk errors must not turn a successful TIRA operation into a retry.
          this.logger.warn(
            `Unable to append TIRA request log ${safeId}: ${(error as NodeJS.ErrnoException).code || 'LOG_WRITE_FAILED'}`,
          );
        }
      },
    );
    this.pendingWrites.set(filename, write);
    await write;
    if (this.pendingWrites.get(filename) === write) {
      this.pendingWrites.delete(filename);
    }
  }

  sanitizeXml(xml: string | null | undefined): string | null {
    if (!xml) return xml ?? null;

    if (
      !this.configService.get<boolean>(
        'tiramisService.requestLogRedactXml',
        true,
      )
    ) {
      return xml;
    }

    const tags = this.xmlRedactionTags();
    if (!tags.length) return xml;

    let redacted = xml;
    for (const tag of tags) {
      const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      redacted = redacted.replace(
        new RegExp(`<(${escaped})(\\s[^>]*)?>[\\s\\S]*?<\\/\\1>`, 'gi'),
        (_match, name: string, attributes = '') =>
          `<${name}${attributes}>[redacted]</${name}>`,
      );
    }
    return redacted;
  }

  private sanitizeEntry(
    entry: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(entry)) {
      if (
        typeof value === 'string' &&
        (key === 'xml' || key === 'rawXml' || key === 'rawPayload')
      ) {
        result[key] = this.sanitizeXml(value);
        result[`${key}Sha256`] = createHash('sha256')
          .update(value, 'utf8')
          .digest('hex');
        continue;
      }
      result[key] = value;
    }
    return result;
  }

  private xmlRedactionTags(): string[] {
    const configured = this.configService.get<string>(
      'tiramisService.requestLogRedactedXmlTags',
      '',
    );
    const fallback = [
      'MsgSignature',
      'ClientKey',
      'PolicyHolderName',
      'PolicyHolderBirthDate',
      'PolicyHolderPhoneNumber',
      'PolicyHolderEmail',
      'PolicyHolderIdNumber',
      'InsuredName',
      'ClaimantName',
      'ClaimantPhoneNumber',
      'ClaimantEmail',
    ];
    const values = configured
      ? configured.split(',').map((value) => value.trim())
      : fallback;
    return values.filter((value) =>
      /^[A-Za-z][A-Za-z0-9_-]{0,80}$/.test(value),
    );
  }
}
