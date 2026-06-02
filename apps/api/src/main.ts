import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  // Allow the Angular dev server to send cookies cross-origin during local development
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://127.0.0.1:4200',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
