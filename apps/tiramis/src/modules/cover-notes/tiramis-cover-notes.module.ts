import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisConfigModule } from '../config/tiramis-config.module';
import { TiramisMessagingModule } from '../messaging/tiramis-messaging.module';
import { TiramisSubmissionsModule } from '../submissions/tiramis-submissions.module';
import { TiramisCoverNotesController } from './controllers/tiramis-cover-notes.controller';
import { TiramisCoverNoteAddonEntity } from './entities/tiramis-cover-note-addon.entity';
import { TiramisCoverNoteDiscountEntity } from './entities/tiramis-cover-note-discount.entity';
import { TiramisCoverNoteEntity } from './entities/tiramis-cover-note.entity';
import { TiramisCoverNoteRiskEntity } from './entities/tiramis-cover-note-risk.entity';
import { TiramisCoverNoteTaxEntity } from './entities/tiramis-cover-note-tax.entity';
import { TiramisPolicyHolderEntity } from './entities/tiramis-policy-holder.entity';
import { TiramisSubjectMatterEntity } from './entities/tiramis-subject-matter.entity';
import { TiramisCoverNoteRepository } from './repositories/tiramis-cover-note.repository';
import { TiramisCoverNotePayloadService } from './services/tiramis-cover-note-payload.service';
import { TiramisCoverNoteService } from './services/tiramis-cover-note.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TiramisCoverNoteEntity,
      TiramisCoverNoteRiskEntity,
      TiramisCoverNoteDiscountEntity,
      TiramisCoverNoteTaxEntity,
      TiramisSubjectMatterEntity,
      TiramisCoverNoteAddonEntity,
      TiramisPolicyHolderEntity,
    ]),
    TiramisConfigModule,
    TiramisMessagingModule,
    TiramisSubmissionsModule,
  ],
  controllers: [TiramisCoverNotesController],
  providers: [
    TiramisCoverNoteRepository,
    TiramisCoverNotePayloadService,
    TiramisCoverNoteService,
  ],
  exports: [
    TiramisCoverNoteRepository,
    TiramisCoverNotePayloadService,
    TiramisCoverNoteService,
  ],
})
export class TiramisCoverNotesModule {}
