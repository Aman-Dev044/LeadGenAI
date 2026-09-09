import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Public } from '../../common/decorators';
import { CacheService } from '../../providers/redis/cache.service';

@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly cache: CacheService,
  ) {}

  @Public()
  @Get()
  async check() {
    const mongoStatus =
      this.connection.readyState === 1 ? 'connected' : 'disconnected';

    let redisStatus = 'disabled';
    if (this.cache.isEnabled()) {
      try {
        await this.cache.set('health:ping', 'pong', 10);
        const val = await this.cache.get('health:ping');
        redisStatus = val === 'pong' ? 'connected' : 'error';
      } catch {
        redisStatus = 'error';
      }
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoStatus,
        redis: redisStatus,
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  @Public()
  @Get('ping')
  ping() {
    return { pong: true };
  }
}
