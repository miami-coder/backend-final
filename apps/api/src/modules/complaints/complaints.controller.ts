import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { Complaint } from './entities/complaint.entity';
import { ApiDataResponse } from '../../common/swagger/response-helpers';

@ApiTags('Complaints')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard)
export class ComplaintsController {
  constructor(private readonly complaints: ComplaintsService) {}

  @Post('complaints')
  @ApiOperation({ summary: 'Подати скаргу' })
  @ApiDataResponse({
    status: 201,
    type: Complaint,
    description: 'Створена скарга',
  })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({
    description: 'Не можна скаржитись на власний контент',
  })
  @ApiNotFoundResponse({ description: 'Обʼєкт скарги не знайдено' })
  @ApiBadRequestResponse({ description: 'Невалідні дані' })
  create(@CurrentUser() u: JwtUser, @Body() dto: CreateComplaintDto) {
    return this.complaints.create(u.sub, dto).then((data) => ({ data }));
  }
}
