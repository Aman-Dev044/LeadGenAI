import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { CreateApiKeyDto } from './dto';

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectModel('ApiKey') private readonly apiKeyModel: Model<any>,
  ) {}

  async create(tenantId: string, dto: CreateApiKeyDto, createdBy: string) {
    // Generate a random API key
    const rawKey = `ak_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 10);

    const apiKey = await this.apiKeyModel.create({
      tenantId,
      name: dto.name,
      keyHash,
      keyPrefix,
      permissions: dto.permissions || ['read'],
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      createdBy,
    });

    // Return the raw key only at creation - cannot be retrieved again
    return {
      id: apiKey._id,
      name: apiKey.name,
      key: rawKey,
      keyPrefix,
      permissions: apiKey.permissions,
      expiresAt: apiKey.expiresAt,
      message: 'Save this key securely. It cannot be retrieved again.',
    };
  }

  async findAll(tenantId: string) {
    return this.apiKeyModel
      .find({ tenantId, revokedAt: null })
      .select('-keyHash')
      .sort({ createdAt: -1 })
      .lean();
  }

  async revoke(tenantId: string, keyId: string) {
    const apiKey = await this.apiKeyModel.findOneAndUpdate(
      { _id: keyId, tenantId, revokedAt: null },
      { revokedAt: new Date(), isActive: false },
      { new: true },
    );
    if (!apiKey) throw new NotFoundException('API key not found');
    return { message: 'API key revoked' };
  }

  async validateKey(rawKey: string): Promise<any | null> {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await this.apiKeyModel.findOne({
      keyHash,
      isActive: true,
      revokedAt: null,
    });

    if (!apiKey) return null;

    // Check expiry
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    // Update last used
    apiKey.lastUsedAt = new Date();
    await apiKey.save();

    return apiKey;
  }
}
