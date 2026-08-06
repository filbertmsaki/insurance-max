import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CoverNote } from './entities/cover-note.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CoverNote])],
  exports: [TypeOrmModule],
})
export class CoverNotesModule {}
