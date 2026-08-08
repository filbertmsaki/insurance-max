import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CoverNotesController } from './cover-notes.controller';
import { CoverNotesService } from './cover-notes.service';
import { CoverNote } from './entities/cover-note.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CoverNote])],
  controllers: [CoverNotesController],
  providers: [CoverNotesService],
  exports: [TypeOrmModule, CoverNotesService],
})
export class CoverNotesModule {}
