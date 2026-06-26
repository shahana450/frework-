import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { CacheModule } from "@nestjs/cache-manager";
import { ScheduleModule } from "@nestjs/schedule";
import { APP_GUARD } from "@nestjs/core";
import { redisStore } from "cache-manager-ioredis-yet";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { FreelancersModule } from "./modules/freelancers/freelancers.module";
import { ClientsModule } from "./modules/clients/clients.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { CoworkingModule } from "./modules/coworking/coworking.module";
import { BookingsModule } from "./modules/bookings/bookings.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { MessagingModule } from "./modules/messaging/messaging.module";
import { StartupsModule } from "./modules/startups/startups.module";
import { InvestorsModule } from "./modules/investors/investors.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AiModule } from "./modules/ai/ai.module";
import { AdminModule } from "./modules/admin/admin.module";
import { SearchModule } from "./modules/search/search.module";
import { CommunityModule } from "./modules/community/community.module";
import { DatabaseModule } from "./database/database.module";
import appConfig from "./config/app.config";
import authConfig from "./config/auth.config";
import databaseConfig from "./config/database.config";
import storageConfig from "./config/storage.config";

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, databaseConfig, storageConfig],
      envFilePath: [".env.local", ".env"],
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: "short",
          ttl: 1000,
          limit: config.get("THROTTLE_SHORT_LIMIT", 10),
        },
        {
          name: "medium",
          ttl: 10000,
          limit: config.get("THROTTLE_MEDIUM_LIMIT", 50),
        },
        {
          name: "long",
          ttl: 60000,
          limit: config.get("THROTTLE_LONG_LIMIT", 200),
        },
      ],
    }),

    // Caching (Redis)
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        store: redisStore,
        url: config.get("REDIS_URL", "redis://localhost:6379"),
        ttl: 300,
      }),
    }),

    // Scheduled tasks
    ScheduleModule.forRoot(),

    // Feature modules
    DatabaseModule,
    AuthModule,
    UsersModule,
    FreelancersModule,
    ClientsModule,
    ProjectsModule,
    CoworkingModule,
    BookingsModule,
    PaymentsModule,
    MessagingModule,
    StartupsModule,
    InvestorsModule,
    ReviewsModule,
    NotificationsModule,
    AiModule,
    AdminModule,
    SearchModule,
    CommunityModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
