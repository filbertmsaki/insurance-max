import { Inject, Injectable, NotFoundException } from '@nestjs/common';

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
}
