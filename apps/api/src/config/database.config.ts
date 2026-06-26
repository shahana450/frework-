import { registerAs } from "@nestjs/config";

export default registerAs("database", () => ({
  url: process.env.DATABASE_URL,
  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
    password: process.env.REDIS_PASSWORD,
  },
}));
