import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ComplaintsController {
  constructor(private readonly complaints: ComplaintsService) {}

  @Post('complaints')
  create(@CurrentUser() u: JwtUser, @Body() dto: CreateComplaintDto) {
    return this.complaints.create(u.sub, dto).then((data) => ({ data }));
  }
}
