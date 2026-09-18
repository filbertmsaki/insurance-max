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
            `${JSON.stringify({ ...entry, timestamp: new Date().toISOString(), requestId })}\n`,
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
}
