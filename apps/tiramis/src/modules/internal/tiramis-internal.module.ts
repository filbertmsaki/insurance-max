import { Module } from '@nestjs/common';

import { TiramisCoverNotesModule } from '../cover-notes/tiramis-cover-notes.module';
import { TiramisMotorModule } from '../motor/tiramis-motor.module';
import { TiramisSubmissionsModule } from '../submissions/tiramis-submissions.module';
import { TiramisInternalController } from './tiramis-internal.controller';

@Module({
  imports: [
    TiramisCoverNotesModule,
    TiramisMotorModule,
    TiramisSubmissionsModule,
  ],
  controllers: [TiramisInternalController],
})
export class TiramisInternalModule {}
