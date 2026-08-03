import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';

import { GeneratedReportPayload } from '../interfaces/report-generator.interface';

@Injectable()
export class ExcelReportWriterService {
  async write(payload: GeneratedReportPayload): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    worksheet.columns = payload.columns.map((column) => ({
      header: column,
      key: column,
      width: Math.max(column.length + 4, 18),
    }));

    for (const row of payload.rows) {
      worksheet.addRow(row);
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
