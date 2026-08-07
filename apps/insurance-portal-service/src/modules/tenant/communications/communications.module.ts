import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';
import { CommunicationMessage } from './entities/communication-message.entity';
import { CommunicationThread } from './entities/communication-thread.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CommunicationThread, CommunicationMessage])],
  controllers: [CommunicationsController],
  providers: [CommunicationsService],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
