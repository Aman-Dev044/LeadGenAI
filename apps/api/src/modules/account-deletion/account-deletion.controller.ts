import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccountDeletionService } from './account-deletion.service';
import {
  SubmitDeletionRequestDto,
  ExecuteOwnershipTransferDto,
  RejectDeletionRequestDto,
  QueryDeletionRequestsDto,
} from './dto/account-deletion.dto';
import { CurrentUser, Roles, SuperAdminOnly } from '../../common/decorators';

@Controller('account-deletion')
export class AccountDeletionController {
  constructor(private readonly deletionService: AccountDeletionService) {}

  // =========================================================================
  // User (Admin & Salesperson) Endpoints
  // =========================================================================

  /**
   * Submit an account deletion request (Admin or Salesperson).
   */
  @Post('request')
  @Roles('ADMIN', 'SALESPERSON', 'SALES_MANAGER', 'VIEWER')
  async submitRequest(
    @CurrentUser() user: any,
    @Body() dto: SubmitDeletionRequestDto,
  ) {
    return this.deletionService.submitDeletionRequest(user, dto);
  }

  /**
   * Get current user's active pending deletion request.
   */
  @Get('my-request')
  @Roles('ADMIN', 'SALESPERSON', 'SALES_MANAGER', 'VIEWER')
  async getMyRequest(@CurrentUser() user: any) {
    return this.deletionService.getMyRequest(user);
  }

  /**
   * Cancel current user's active pending deletion request.
   */
  @Delete('my-request')
  @Roles('ADMIN', 'SALESPERSON', 'SALES_MANAGER', 'VIEWER')
  async cancelMyRequest(@CurrentUser() user: any) {
    return this.deletionService.cancelMyRequest(user);
  }

  /**
   * Request OTP code for ownership transfer (Admin only).
   */
  @Post('transfer-ownership/otp')
  @Roles('ADMIN')
  async requestOwnershipOtp(@CurrentUser() user: any) {
    return this.deletionService.requestOwnershipTransferOtp(user);
  }

  /**
   * Execute ownership transfer with 6-char OTP verification (Admin only).
   */
  @Post('transfer-ownership/execute')
  @Roles('ADMIN')
  async executeOwnershipTransfer(
    @CurrentUser() user: any,
    @Body() dto: ExecuteOwnershipTransferDto,
  ) {
    return this.deletionService.executeOwnershipTransfer(user, dto);
  }

  // =========================================================================
  // SuperAdmin Console Endpoints
  // =========================================================================

  /**
   * List deletion requests for review.
   */
  @Get('admin/requests')
  @SuperAdminOnly()
  async listRequests(@Query() query: QueryDeletionRequestsDto) {
    return this.deletionService.listRequests(query);
  }

  /**
   * Approve deletion request (cascades to tenant & staff if admin, single user if staff).
   */
  @Post('admin/requests/:id/approve')
  @SuperAdminOnly()
  async approveRequest(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.deletionService.approveRequest(id, user);
  }

  /**
   * Reject deletion request with reason.
   */
  @Post('admin/requests/:id/reject')
  @SuperAdminOnly()
  async rejectRequest(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: RejectDeletionRequestDto,
  ) {
    return this.deletionService.rejectRequest(id, user, dto);
  }
}
