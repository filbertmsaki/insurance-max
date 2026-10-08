import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CoverNotesController } from './cover-notes.controller';
import { CoverNotesService } from './cover-notes.service';
import { CoverNote } from './entities/cover-note.entity';
import { IssuanceModule } from '../issuance/issuance.module';
import { QuotationsModule } from '../quotations/quotations.module';
import { TiramisSubmissionTrackingEntity } from '../../tiramis/entities/tiramis-submission-tracking.entity';
import { PortalTiraSubmission } from '../tiramis-integration/entities/portal-tira-submission.entity';
import { TiramisModule } from '../../tiramis/tiramis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CoverNote,
      TiramisSubmissionTrackingEntity,
      PortalTiraSubmission,
    ]),
    IssuanceModule,
    QuotationsModule,
    TiramisModule,
  ],
  controllers: [CoverNotesController],
  providers: [CoverNotesService],
  exports: [TypeOrmModule, CoverNotesService],
})
export class CoverNotesModule {}
