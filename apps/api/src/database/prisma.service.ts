import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: "query", emit: "event" },
        { level: "error", emit: "stdout" },
        { level: "warn", emit: "stdout" },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log("Database connected");

    // Log slow queries in development
    if (process.env.NODE_ENV === "development") {
      (this.$on as any)("query", (e: any) => {
        if (e.duration > 100) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log("Database disconnected");
  }

  async cleanDb() {
    if (process.env.NODE_ENV === "production") {
      throw new Error("cleanDb is not allowed in production");
    }
    const modelNames = Object.keys(this).filter(
      (key) => !key.startsWith("_") && !key.startsWith("$")
    );
    return Promise.all(modelNames.map((model) => (this as any)[model].deleteMany()));
  }
}
