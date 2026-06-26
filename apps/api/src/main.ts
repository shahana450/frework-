import { NestFactory } from "@nestjs/core";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { NestExpressApplication } from "@nestjs/platform-express";
import * as compression from "compression";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["error", "warn", "log", "debug"],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>("PORT", 4000);
  const nodeEnv = configService.get<string>("NODE_ENV", "development");

  // Security
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: nodeEnv === "production",
  }));
  app.use(compression());

  // CORS
  app.enableCors({
    origin: configService.get<string>("CORS_ORIGINS", "http://localhost:3000").split(","),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  });

  // Versioning
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

  // Global prefix
  app.setGlobalPrefix("api");

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  // Global filters & interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  // Swagger
  if (nodeEnv !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("WorkSphere Global API")
      .setDescription("The comprehensive API for WorkSphere Global platform")
      .setVersion("1.0")
      .addBearerAuth()
      .addTag("Auth", "Authentication endpoints")
      .addTag("Users", "User management")
      .addTag("Freelancers", "Freelancer profiles and search")
      .addTag("Projects", "Job postings and applications")
      .addTag("Coworking", "Workspace discovery and booking")
      .addTag("Payments", "Payment processing and wallet")
      .addTag("Messaging", "Real-time chat")
      .addTag("Startups", "Startup profiles and funding")
      .addTag("Investors", "Investor portal")
      .addTag("AI", "AI-powered features")
      .addTag("Admin", "Admin dashboard APIs")
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port);
  console.log(`🚀 WorkSphere API running on: http://localhost:${port}/api/v1`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
