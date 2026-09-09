import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { Roles, CurrentTenant } from '../../common/decorators';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('users')
@Roles('ADMIN')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateUserDto,
  ) {
    return this.userService.create(tenantId, dto);
  }

  @Get()
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.userService.findAll(tenantId, paginationDto);
  }

  // Must be declared before ':id'. Open to every dashboard role so assignment dropdowns work for non-admins.
  @Get('assignable')
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON', 'VIEWER')
  async findAssignable(@CurrentTenant() tenantId: string) {
    return this.userService.findAssignable(tenantId);
  }

  @Get(':id')
  async findById(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.userService.findById(tenantId, id);
  }

  @Patch(':id')
  async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.userService.update(tenantId, id, dto);
  }

  @Patch(':id/activate')
  async activate(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.userService.activate(tenantId, id);
  }

  @Patch(':id/deactivate')
  async deactivate(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.userService.deactivate(tenantId, id);
  }

  @Delete(':id')
  async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.userService.remove(tenantId, id);
  }
}
