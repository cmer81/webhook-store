import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Next,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Webhook } from '@prisma/client';
import { NextFunction } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/hello')
  getHello(@Req() req): Promise<string> {
    return this.appService.getCount(req.hostname);
  }

  @Post('/*')
  async createWebhookWithoutPath(
    @Body() body,
    @Ip() ip,
    @Headers() headers,
    @Param() params: string[],
    @Next() next: NextFunction,
    @Res() res,
    @Req() req,
  ): Promise<Webhook | void> {
    const path = params['0'];
    if (path === 'graphql') {
      return next();
    }

    const webhook = await this.appService.addWebhook({
      body,
      headers,
      ip,
      path,
      host: req.hostname,
    });
    return res.send(webhook);
  }

  @Delete()
  deleteWebhooks(): Promise<{ count: number }> {
    return this.appService.deleteWebhooks();
  }
}
