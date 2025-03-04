import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Ip,
  Logger,
  Next,
  Param,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Webhook } from '@prisma/client';
import { NextFunction } from 'express';
import { ProxyService } from '../application/proxy-response/proxy.service';
import { WebhookService } from '../application/webhook/webhook.service';
import { Response } from 'express';
import webhookConfig from '../config/webhook.config';
import { Hostname } from './decorators/hostname.decorator';
import { Json } from 'fp-ts/lib/Json';
import { option } from 'fp-ts';
import { UserGuard } from './guards/user.guard';
import { AdminGuard } from './guards/admin.guard';
import { AuthMetadata, AuthService } from '../application/auth/auth.service';
import {
  WebhookStoreMetadata,
  WebhookStoreMetadatService,
} from '../application/webhook/webhook-store-metadata.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly webhookService: WebhookService,
    private readonly proxyService: ProxyService,
    @Inject(webhookConfig.KEY)
    private webhookStoreConfig: ConfigType<typeof webhookConfig>,
    private readonly authService: AuthService,
    private readonly webhookStoreMetadatService: WebhookStoreMetadatService,
  ) {}

  @Get('/count-webhooks')
  @UseGuards(UserGuard)
  countWebhooks(@Hostname.fromRequest() hostname: string): Promise<string> {
    return this.webhookService.getCount(hostname);
  }

  @Get('/webhooks-per-host')
  @UseGuards(AdminGuard)
  getWebhooksGroupByHosts(): Promise<any> {
    return this.webhookService.getWebhooksPerHosts();
  }

  @Get('/auth-metadata')
  getAutheMetadata(): AuthMetadata {
    const authMetadata = this.authService.getAuthMetadata();
    return authMetadata;
  }

  @Get('/store-metadata')
  @UseGuards(UserGuard)
  getStoreMetadata(): WebhookStoreMetadata {
    const webhookStoreMetadata =
      this.webhookStoreMetadatService.getWebbookStoreMetadata();
    return webhookStoreMetadata;
  }

  @Post('/*')
  @UseInterceptors(AnyFilesInterceptor())
  async createWebhook(
    @Body() body: Json,
    @UploadedFiles() files: Array<Express.Multer.File> | undefined,
    @Ip() ip: string,
    @Headers() headers: Record<string, string>,
    @Param() params: string[],
    @Next() next: NextFunction,
    @Res() res: Response,
    @Hostname.fromRequest() host: string,
  ): Promise<Response<Webhook> | void> {
    const path = params['0'] ? `/${params['0']}` : '/';
    if (path === '/graphql') {
      return next();
    }
    this.logger.log(`Webhook received on ${path}`);
    const webhook = await this.webhookService.handleIncomingWebhook(
      body,
      files || [],
      headers,
      ip,
      path,
      host,
    )();
    if (option.isSome(this.webhookStoreConfig.defaultHost)) {
      this.proxyService.sendAndStoreWebhookToTargets(
        this.webhookStoreConfig.defaultHost.value,
        body,
        headers,
        path,
        webhook.id,
        host,
      );
    }
    return res.send(webhook);
  }

  @Delete()
  deleteWebhooks(
    @Hostname.fromRequest() host: string,
  ): Promise<{ count: number }[]> {
    return this.webhookService.deleteWebhooks(host)();
  }
}
