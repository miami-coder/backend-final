import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './services/auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { OAuthHandlerService } from './auth.service.oauth';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly oauthHandler: OAuthHandlerService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60 * 1000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60 * 1000 } })
  refresh(@Body('refreshToken') token: string) {
    return this.auth.refresh(token);
  }

  @Public()
  @Post('logout')
  logout(@Body('refreshToken') token: string) {
    return this.auth.logout(token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() current: JwtUser) {
    return { data: { id: current.sub, email: current.email, roles: current.roles } };
  }

  // OAuth: Google
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async google() {}

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const url = await this.oauthHandler.buildRedirectUrl(req.user as any);
    res.redirect(url);
  }

  // OAuth: Facebook
  @Public()
  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  async facebook() {}

  @Public()
  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  async facebookCallback(@Req() req: Request, @Res() res: Response) {
    const url = await this.oauthHandler.buildRedirectUrl(req.user as any);
    res.redirect(url);
  }
}
