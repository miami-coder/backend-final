import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './services/auth.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { OAuthHandlerService } from './auth.service.oauth';

@ApiTags('Auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly oauthHandler: OAuthHandlerService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @ApiOperation({ summary: 'Реєстрація користувача (email + пароль)' })
  @ApiOkResponse({
    type: AuthResponseDto,
    description: 'Токени та дані користувача',
  })
  @ApiConflictResponse({ description: 'Email зайнято / не прийнято EULA' })
  @ApiBadRequestResponse({ description: 'Невалідні дані' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60 * 1000 } })
  @ApiOperation({ summary: 'Вхід (email + пароль)' })
  @ApiOkResponse({
    type: AuthResponseDto,
    description: 'Токени та дані користувача',
  })
  @ApiUnauthorizedResponse({ description: 'Невірний email або пароль' })
  @ApiBadRequestResponse({ description: 'Невалідні дані' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60 * 1000 } })
  @ApiOperation({ summary: 'Оновити access token (ротація refresh token)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { refreshToken: { type: 'string' } },
      required: ['refreshToken'],
    },
  })
  @ApiOkResponse({ type: AuthResponseDto, description: 'Нові токени' })
  @ApiUnauthorizedResponse({
    description: 'Невірний або скасований refresh token',
  })
  refresh(@Body('refreshToken') token: string) {
    return this.auth.refresh(token);
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Вийти (скасувати refresh token)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { refreshToken: { type: 'string' } },
      required: ['refreshToken'],
    },
  })
  @ApiOkResponse({ description: 'Refresh token скасовано' })
  logout(@Body('refreshToken') token: string) {
    return this.auth.logout(token);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Поточний користувач за access token' })
  @ApiOkResponse({
    description: 'Дані поточного користувача',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string' },
            roles: { type: 'array', items: { type: 'string' } },
            profile: {
              type: 'object',
              nullable: true,
              properties: {
                firstname: { type: 'string', nullable: true },
                lastname: { type: 'string', nullable: true },
              },
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  async me(@CurrentUser() current: JwtUser) {
    // profile у відповіді: шапка фронта показує імʼя замість пошти
    // (profile створюється при реєстрації; null — OAuth-крайовий випадок)
    const profile = await this.users.getProfile(current.sub);
    return {
      data: {
        id: current.sub,
        email: current.email,
        roles: current.roles,
        profile: profile
          ? { firstname: profile.firstname, lastname: profile.lastname }
          : null,
      },
    };
  }

  // OAuth: Google
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Почати OAuth-вхід через Google' })
  @ApiFoundResponse({ description: 'Перенаправлення на Google' })
  async google() {}

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Callback OAuth Google' })
  @ApiFoundResponse({ description: 'Перенаправлення на фронтенд із токенами' })
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const url = await this.oauthHandler.buildRedirectUrl(
      req.user as { id: string; email: string },
    );
    res.redirect(url);
  }

  // OAuth: Facebook
  @Public()
  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  @ApiOperation({ summary: 'Почати OAuth-вхід через Facebook' })
  @ApiFoundResponse({ description: 'Перенаправлення на Facebook' })
  async facebook() {}

  @Public()
  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  @ApiOperation({ summary: 'Callback OAuth Facebook' })
  @ApiFoundResponse({ description: 'Перенаправлення на фронтенд із токенами' })
  async facebookCallback(@Req() req: Request, @Res() res: Response) {
    const url = await this.oauthHandler.buildRedirectUrl(
      req.user as { id: string; email: string },
    );
    res.redirect(url);
  }
}
