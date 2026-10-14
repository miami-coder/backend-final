import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
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
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { Message } from './entities/message.entity';
import {
  ApiDataResponse,
  ApiPaginatedResponse,
} from '../../common/swagger/response-helpers';

@ApiTags('Admin · Messages')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminMessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('admin/messages/feedback')
  @Permissions('user:manage')
  @ApiOperation({ summary: 'Скринька зворотного звʼязку «написати нам»' })
  @ApiPaginatedResponse({ type: Message, description: 'Повідомлення фідбеку' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу user:manage' })
  listFeedback(@Query() q: { page?: number; limit?: number }) {
    return this.messages.listFeedback(q);
  }

  @Post('admin/messages/feedback/:id/reply')
  @Permissions('user:manage')
  @ApiOperation({ summary: 'Відповісти на зворотний звʼязок' })
  @ApiDataResponse({ status: 201, type: Message, description: 'Відповідь' })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу user:manage' })
  @ApiNotFoundResponse({ description: 'Повідомлення не знайдено' })
  replyToFeedback(
    @CurrentUser() u: JwtUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messages.replyToFeedback(u.sub, id, dto).then((data) => ({
      data,
    }));
  }

  @Post('admin/users/:id/message')
  @Permissions('user:manage')
  @ApiOperation({ summary: 'Системне повідомлення від «Пиячок» користувачу' })
  @ApiDataResponse({ status: 201, type: Message, description: 'Повідомлення' })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу user:manage' })
  @ApiNotFoundResponse({ description: 'Користувача не знайдено' })
  sendSystem(@Param('id') userId: string, @Body() dto: SendMessageDto) {
    return this.messages.sendSystem(userId, dto).then((data) => ({ data }));
  }
}