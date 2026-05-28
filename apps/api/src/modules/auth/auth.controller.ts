import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthUser } from '@worn-tape-memory/shared';

interface AuthenticatedRequest extends Request {
  user: { userId: string; spotifyUserId: string };
}

const IS_PROD = process.env.NODE_ENV === 'production';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('spotify/exchange')
  @HttpCode(200)
  async exchange(
    @Body() body: { code: string; code_verifier: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const token = await this.auth.exchangeSpotifyCode(body.code, body.code_verifier);

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: IS_PROD,
      // 30-day session
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return { ok: true };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    res.clearCookie('token', { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: AuthenticatedRequest): Promise<AuthUser> {
    return this.auth.getMe(req.user.userId);
  }
}
