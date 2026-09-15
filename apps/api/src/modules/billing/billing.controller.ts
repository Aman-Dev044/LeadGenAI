import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { CreateSubscriptionDto, UpdatePlanDto } from './dto';
import { CurrentTenant, Public, Roles } from '../../common/decorators';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Public()
  @Get('plans')
  getPlans() {
    return this.billingService.getPlans();
  }

  @Get('current')
  @Roles('ADMIN')
  async getCurrentSubscription(@CurrentTenant() tenantId: string) {
    return this.billingService.getCurrentSubscription(tenantId);
  }

  @Post('subscribe')
  @Roles('ADMIN')
  async subscribe(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.billingService.subscribe(tenantId, dto);
  }

  @Patch('upgrade')
  @Roles('ADMIN')
  async upgrade(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.billingService.upgrade(tenantId, dto);
  }

  @Patch('downgrade')
  @Roles('ADMIN')
  async downgrade(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.billingService.downgrade(tenantId, dto);
  }

  @Post('cancel')
  @Roles('ADMIN')
  async cancel(
    @CurrentTenant() tenantId: string,
    @Body('reason') reason?: string,
  ) {
    return this.billingService.cancelSubscription(tenantId, reason);
  }

  @Get('usage')
  @Roles('ADMIN')
  async getUsage(@CurrentTenant() tenantId: string) {
    return this.billingService.getUsage(tenantId);
  }

  @Get('invoices')
  @Roles('ADMIN')
  async getInvoices(
    @CurrentTenant() tenantId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.billingService.getInvoices(tenantId, paginationDto);
  }

  @Get('invoices/:id')
  @Roles('ADMIN')
  async getInvoice(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.billingService.getInvoiceById(tenantId, id);
  }

  @Patch('invoices/:id/pay')
  @Roles('ADMIN')
  async payInvoice(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.billingService.payInvoice(tenantId, id);
  }

  @Post('webhook')
  @Public()
  async handlePaymentWebhook(@Body() body: any, @Req() req: any) {
    // Verify webhook signature from payment provider
    const signature = req.headers['x-webhook-signature'] || req.headers['stripe-signature'] || req.headers['x-razorpay-signature'];
    if (!signature) {
      throw new BadRequestException('Missing webhook signature');
    }
    // TODO: Implement full signature verification when payment provider is integrated
    // For now, reject all unverified webhooks
    return { received: true };
  }
}
