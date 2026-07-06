import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class TiramisBusinessSchemaService {
  constructor(private readonly dataSource: DataSource) {}

  async getSchemaStatus() {
    const tables = [
      'tiramis_submission_tracking',
      'tiramis_business_records',
      'tiramis_notifications',
      'tiramis_audit_logs',
    ];

    const result: Record<string, boolean> = {};

    for (const table of tables) {
      try {
        await this.dataSource.query(`SELECT 1 FROM ${table} LIMIT 1`);
        result[table] = true;
      } catch {
        result[table] = false;
      }
    }

    return {
      success: true,
      tables: result,
      allPresent: Object.values(result).every(Boolean),
    };
  }
}
