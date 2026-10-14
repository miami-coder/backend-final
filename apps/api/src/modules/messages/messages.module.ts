import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { AdminMessagesController } from './admin-messages.controller';
import { VenuesModule } from '../venues/venues.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [TypeOrmModule.forFeature([Message]), VenuesModule, RbacModule],
  providers: [MessagesService],
  controllers: [MessagesController, AdminMessagesController],
  exports: [MessagesService],
})
export class MessagesModule {}