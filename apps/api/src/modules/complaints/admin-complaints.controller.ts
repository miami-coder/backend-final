import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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
import { ComplaintsService } from './complaints.service';
import { ResolveComplaintDto } from './dto/resolve-complaint.dto';
import { Complaint } from './entities/complaint.entity';
import {
  ApiDataResponse,
  ApiPaginatedResponse,
} from '../../common/swagger/response-helpers';

@ApiTags('Admin · Complaints')
@ApiBearerAuth('access-token')
@Controller('admin/complaints')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminComplaintsController {
  constructor(private readonly complaints: ComplaintsService) {}

  @Get()
  @Permissions('complaint:manage')
  @ApiOperation({ summary: 'Список скарг на розгляді' })
  @ApiPaginatedResponse({
    type: Complaint,
    description: 'Сторінкований список скарг',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Номер сторінки',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Розмір сторінки',
  })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу complaint:manage' })
  list(@Query('page') page: number, @Query('limit') limit: number) {
    return this.complaints.listPending(page, limit);
  }

  @Post(':id/resolve')
  @Permissions('complaint:manage')
  @ApiOperation({ summary: 'Вирішити скаргу' })
  @ApiDataResponse({ type: Complaint, description: 'Вирішена скарга' })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу complaint:manage' })
  @ApiNotFoundResponse({ description: 'Скаргу не знайдено' })
  @ApiBadRequestResponse({
    description: 'Скаргу вже вирішено / невалідні дані',
  })
  resolve(
    @CurrentUser() u: JwtUser,
    @Param('id') id: string,
    @Body() dto: ResolveComplaintDto,
  ) {
    return this.complaints.resolve(id, u.sub, dto).then((data) => ({ data }));
  }
}
