import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  RegisteredReportDefinition,
  ReportCategory,
  ReportOutputFormat,
  ReportSensitivity,
} from '@insurance-max/contracts';

import { ReportDefinition } from '../entities/report-definition.entity';
import {
  REPORT_GENERATORS,
  ReportGenerator,
} from '../interfaces/report-generator.interface';

@Injectable()
export class ReportRegistryService {
  constructor(
    @Inject(REPORT_GENERATORS)
    private readonly generators: ReportGenerator[],
  ) {}

  getGenerator(definition: ReportDefinition) {
    const generator = this.generators.find((candidate) =>
      candidate.supports(definition),
    );

    if (!generator) {
      throw new NotFoundException(
        `No registered report generator supports "${definition.code}"`,
      );
    }

    return generator;
  }

  listGenerators() {
    return this.generators.map((generator) => generator.key);
  }

  serializeDefinition(
    definition: ReportDefinition,
  ): RegisteredReportDefinition {
    return {
      id: definition.id,
      code: definition.code,
      name: definition.name,
      description: definition.description ?? '',
      category: definition.category ?? ReportCategory.MANAGEMENT,
      version: definition.version ?? 1,
      supportedFormats: (definition.supported_formats ?? []).map(
        (format) => format as unknown as ReportOutputFormat,
      ),
      sensitivity: definition.sensitivity ?? ReportSensitivity.INTERNAL,
      permission: definition.permission ?? 'reports:run',
      maximumRows: definition.maximum_rows ?? definition.max_rows ?? 100000,
      asynchronousOnly: definition.asynchronous_only ?? false,
      parameters: definition.parameters ?? [],
    };
  }
}
