import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisConfigModule } from '../config/tiramis-config.module';
import { TiramisCoverNoteEntity } from '../cover-notes/entities/tiramis-cover-note.entity';
import { TiramisMessagingModule } from '../messaging/tiramis-messaging.module';
import { TiramisSubmissionsModule } from '../submissions/tiramis-submissions.module';

import { TiramisCallbackController } from './controllers/tiramis-callback.controller';
import { TiramisCallbackService } from './services/tiramis-callback.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TiramisCoverNoteEntity]),
    TiramisConfigModule,
    TiramisMessagingModule,
    TiramisSubmissionsModule,
  ],
  controllers: [TiramisCallbackController],
  providers: [TiramisCallbackService],
  exports: [TiramisCallbackService],
})
export class TiramisCallbacksModule {}
