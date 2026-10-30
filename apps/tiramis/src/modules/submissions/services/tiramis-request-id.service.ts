import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * TIRA RequestId: {prefix}{yyMMddHHmmssSSS}{4-digit counter}, letters and
 * digits only. The counter is a database sequence that wraps at 9999, so it
 * stays unique across app instances; the millisecond timestamp keeps ids
 * unique after a database reset or a counter wrap.
 */
@Injectable()
export class TiramisRequestIdService {
  private readonly timeZone = 'Africa/Dar_es_Salaam';

  constructor(private readonly dataSource: DataSource) {}

  async generate(prefix = 'AIC'): Promise<string> {
    const rows: Array<{ value: string }> = await this.dataSource.query(
      `SELECT nextval('tiramis_request_id_counter_seq') AS value`,
    );
    const counter = String(Number(rows[0].value)).padStart(4, '0');
    const cleanPrefix = prefix.toUpperCase().replace(/[^A-Z0-9]/g, '');

    return `${cleanPrefix}${this.timestamp(new Date())}${counter}`;
  }

  /** yyMMddHHmmssSSS in Tanzania time. */
  private timestamp(date: Date): string {
    const parts = new Map<string, string>(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: this.timeZone,
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
        .formatToParts(date)
        .map((part) => [part.type, part.value]),
    );
    const millis = String(date.getMilliseconds()).padStart(3, '0');
    return ['year', 'month', 'day', 'hour', 'minute', 'second']
      .map((type) => parts.get(type) ?? '')
      .join('')
      .concat(millis);
  }
}
