import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { ComplaintsService } from './complaints.service';
import { ResolveComplaintDto } from './dto/resolve-complaint.dto';

@Controller('admin/complaints')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminComplaintsController {
  constructor(private readonly complaints: ComplaintsService) {}

  @Get()
  @Permissions('complaint:manage')
  list(@Query('page') page: number, @Query('limit') limit: number) {
    return this.complaints.listPending(page, limit);
  }

  @Post(':id/resolve')
  @Permissions('complaint:manage')
  resolve(
    @CurrentUser() u: JwtUser,
    @Param('id') id: string,
    @Body() dto: ResolveComplaintDto,
  ) {
    return this.complaints.resolve(id, u.sub, dto).then((data) => ({ data }));
  }
}
