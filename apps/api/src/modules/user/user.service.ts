import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UpdateUserDto } from './dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/paginate';
import { escapeRegex } from '../../common/utils/sanitize';

@Injectable()
export class UserService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<any>,
    @InjectModel('RefreshToken') private readonly refreshTokenModel: Model<any>,
  ) {}

  async create(tenantId: string, dto: CreateUserDto) {
    const existing = await this.userModel.findOne({
      tenantId,
      email: dto.email,
    });
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = await this.userModel.create({
      tenantId,
      ...dto,
      password: hashedPassword,
    });

    return this.sanitizeUser(user);
  }

  async findAll(tenantId: string, paginationDto: PaginationDto) {
    const query: any = { deletedAt: null };
    if (tenantId && tenantId !== 'all') {
      query.tenantId = tenantId;
    }

    if (paginationDto.search) {
      const safeSearch = escapeRegex(paginationDto.search);
      query.$or = [
        { firstName: { $regex: safeSearch, $options: 'i' } },
        { lastName: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    return paginate(this.userModel, query, paginationDto);
  }

  /** Lightweight list of active team members for assignment dropdowns (any dashboard role may read it). */
  async findAssignable(tenantId: string) {
    const filter: any = { isActive: true, deletedAt: null, role: { $in: ['ADMIN', 'SALES_MANAGER', 'SALESPERSON'] } };
    if (tenantId && tenantId !== 'all') {
      filter.tenantId = tenantId;
    }
    return this.userModel
      .find(filter)
      .select('firstName lastName email role avatar')
      .sort({ firstName: 1, lastName: 1 })
      .limit(500)
      .lean();
  }

  async findById(tenantId: string, userId: string) {
    const filter: any = { _id: userId, deletedAt: null };
    if (tenantId && tenantId !== 'all') {
      filter.tenantId = tenantId;
    }
    const user = await this.userModel.findOne(filter);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.sanitizeUser(user);
  }

  async update(tenantId: string, userId: string, dto: UpdateUserDto) {
    const filter: any = { _id: userId, deletedAt: null };
    if (tenantId && tenantId !== 'all') {
      filter.tenantId = tenantId;
    }
    const user = await this.userModel.findOneAndUpdate(
      filter,
      { $set: dto },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.sanitizeUser(user);
  }

  async deactivate(tenantId: string, userId: string) {
    const filter: any = { _id: userId };
    if (tenantId && tenantId !== 'all') {
      filter.tenantId = tenantId;
    }
    const user = await this.userModel.findOneAndUpdate(
      filter,
      { isActive: false },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { message: 'User deactivated' };
  }

  async activate(tenantId: string, userId: string) {
    const filter: any = { _id: userId };
    if (tenantId && tenantId !== 'all') {
      filter.tenantId = tenantId;
    }
    const user = await this.userModel.findOneAndUpdate(
      filter,
      { isActive: true },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { message: 'User activated' };
  }

  async remove(tenantId: string, userId: string) {
    const filter: any = { _id: userId };
    if (tenantId && tenantId !== 'all') {
      filter.tenantId = tenantId;
    }
    const user = await this.userModel.findOneAndDelete(filter);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    // Permanently remove all session refresh tokens for this user from DB
    const tokenFilter: any = { userId };
    if (tenantId && tenantId !== 'all') tokenFilter.tenantId = tenantId;
    await this.refreshTokenModel.deleteMany(tokenFilter);
    return { message: 'User permanently deleted from database' };
  }

  private sanitizeUser(user: any) {
    const obj = user.toObject ? user.toObject() : user;
    delete obj.password;
    return obj;
  }
}
