import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CredentialsService } from './credentials.service';
import { CredentialTesterService } from './credential-tester.service';
import { CREDENTIAL_PROVIDER_IDS } from './credential-providers';
import { CurrentTenant, CurrentUser, Roles } from '../../common/decorators';
import { UpsertCredentialDto } from './dto';

type Actor = { userId: string; role: string };

/**
 * Per-workspace API credentials.
 *
 * Admin-only, and deliberately write-only for anything secret: no response from
 * this controller ever contains a usable key. Reads return a mask, so a stored
 * secret cannot be recovered from the browser, the network tab or page source -
 * only replaced.
 */
@ApiTags('credentials')
@Controller('credentials')
@Roles('ADMIN')
export class CredentialsController {
  constructor(
    private readonly service: CredentialsService,
    private readonly tester: CredentialTesterService,
  ) {}

  /** Credentials belong to one workspace; the owner must pick one first. */
  private requireTenant(tenantId: string): string {
    if (!tenantId || tenantId === 'all') {
      throw new BadRequestException(
        'Select a workspace first - API credentials belong to a single tenant.',
      );
    }
    return tenantId;
  }

  private requireProvider(id: string): string {
    if (!CREDENTIAL_PROVIDER_IDS.includes(id)) {
      throw new BadRequestException(`Unknown integration "${id}"`);
    }
    return id;
  }

  @Get()
  list(@CurrentTenant() tenantId: string) {
    return this.service.describeAll(tenantId);
  }

  @Put(':provider')
  upsert(
    @CurrentTenant() tenantId: string,
    @Param('provider') provider: string,
    @Body() dto: UpsertCredentialDto,
    @CurrentUser() user: Actor,
  ) {
    return this.service.upsert(
      this.requireTenant(tenantId),
      this.requireProvider(provider),
      { ...(dto.values || {}), ...(dto.enabled === undefined ? {} : { enabled: dto.enabled }) },
      user?.userId,
    );
  }

  @Post(':provider/test')
  test(@CurrentTenant() tenantId: string, @Param('provider') provider: string) {
    return this.tester.test(this.requireTenant(tenantId), this.requireProvider(provider));
  }

  /** Removes this workspace's overrides; the platform defaults take over again. */
  @Delete(':provider')
  clear(@CurrentTenant() tenantId: string, @Param('provider') provider: string) {
    return this.service.clear(this.requireTenant(tenantId), this.requireProvider(provider));
  }
}
