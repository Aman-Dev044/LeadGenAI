import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

@Injectable()
export class CacheService implements OnModuleInit {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis | null = null;
  private enabled = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const restUrl = this.configService.get<string>('upstashRedis.restUrl');
    const restToken = this.configService.get<string>('upstashRedis.restToken');

    if (restUrl && restToken) {
      this.client = new Redis({ url: restUrl, token: restToken });
      this.enabled = true;
      this.logger.log('Upstash Redis cache connected');
    } else {
      this.logger.warn('Redis not configured - caching disabled (app will work without cache)');
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    if (!this.enabled || !this.client) return null;
    try {
      return await this.client.get<T>(key);
    } catch (err) {
      this.logger.warn(`Cache GET failed for "${key}": ${err.message}`);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    if (!this.enabled || !this.client) return;
    try {
      await this.client.set(key, value, { ex: ttlSeconds });
    } catch (err) {
      this.logger.warn(`Cache SET failed for "${key}": ${err.message}`);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (!this.enabled || !this.client || keys.length === 0) return;
    try {
      await this.client.del(...keys);
    } catch (err) {
      this.logger.warn(`Cache DEL failed: ${err.message}`);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.enabled || !this.client) return;
    try {
      let cursor: string | number = 0;
      do {
        const result = await this.client.scan(cursor as number, { match: pattern, count: 100 });
        cursor = result[0];
        const keys = result[1] as string[];
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== 0 && cursor !== '0');
    } catch (err) {
      this.logger.warn(`Cache invalidatePattern failed for "${pattern}": ${err.message}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.enabled || !this.client) return false;
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch {
      return false;
    }
  }

  async incr(key: string): Promise<number> {
    if (!this.enabled || !this.client) return 0;
    try {
      return await this.client.incr(key);
    } catch {
      return 0;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (!this.enabled || !this.client) return;
    try {
      await this.client.expire(key, ttlSeconds);
    } catch {
      // silent
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
