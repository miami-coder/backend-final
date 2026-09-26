import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { Message } from './entities/message.entity';
import {
  ApiDataResponse,
  ApiPaginatedResponse,
} from '../../common/swagger/response-helpers';

@ApiTags('Messages')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Post('venues/:id/messages')
  @ApiOperation({ summary: 'Написати повідомлення менеджеру закладу' })
  @ApiDataResponse({
    status: 201,
    type: Message,
    description: 'Надіслане повідомлення',
  })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiNotFoundResponse({ description: 'Заклад не знайдено' })
  @ApiBadRequestResponse({ description: 'Невалідні дані' })
  sendToVenueManager(
    @CurrentUser() u: JwtUser,
    @Param('id') venueId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messages.sendToVenueManager(u.sub, venueId, dto).then((data) => ({
      data,
    }));
  }

  @Get('me/messages')
  @ApiOperation({ summary: 'Вхідні повідомлення користувача' })
  @ApiPaginatedResponse({ type: Message, description: 'Вхідні повідомлення' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  inbox(
    @CurrentUser() u: JwtUser,
    @Query() q: { page?: number; limit?: number },
  ) {
    return this.messages.listInbox(u.sub, q);
  }

  @Get('me/messages/unread-count')
  @ApiOperation({ summary: 'Кількість непрочитаних повідомлень' })
  @ApiOkResponse({
    description: 'Лічильник непрочитаних',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'object', properties: { count: { type: 'number' } } },
      },
    },
  })
  unreadCount(@CurrentUser() u: JwtUser) {
    return this.messages.unreadCount(u.sub).then((count) => ({ data: { count } }));
  }

  @Patch('me/messages/:id/read')
  @ApiOperation({ summary: 'Позначити повідомлення прочитаним' })
  @ApiDataResponse({ type: Message, description: 'Оновлене повідомлення' })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Це не ваше повідомлення' })
  @ApiNotFoundResponse({ description: 'Повідомлення не знайдено' })
  markRead(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.messages.markRead(u.sub, id).then((data) => ({ data }));
  }

  @Get('me/venues/:id/messages')
  @ApiOperation({ summary: 'Повідомлення користувачів про заклад (для власника)' })
  @ApiPaginatedResponse({ type: Message, description: 'Повідомлення про заклад' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiForbiddenResponse({ description: 'Немає доступу до цього закладу' })
  @ApiNotFoundResponse({ description: 'Заклад не знайдено' })
  venueInbox(
    @CurrentUser() u: JwtUser,
    @Param('id') venueId: string,
    @Query() q: { page?: number; limit?: number },
  ) {
    return this.messages.listVenueInbox(u.sub, venueId, q);
  }

  @Post('me/venues/:id/messages/:messageId/reply')
  @ApiOperation({ summary: 'Відповісти на повідомлення користувача (власник)' })
  @ApiDataResponse({ status: 201, type: Message, description: 'Відповідь' })
  @ApiForbiddenResponse({ description: 'Немає доступу до цього закладу' })
  @ApiNotFoundResponse({ description: 'Повідомлення не знайдено' })
  @ApiBadRequestResponse({ description: 'Невалідні дані' })
  replyToVenueMessage(
    @CurrentUser() u: JwtUser,
    @Param('id') venueId: string,
    @Param('messageId') messageId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messages
      .replyToVenueMessage(u.sub, venueId, messageId, dto)
      .then((data) => ({ data }));
  }
}