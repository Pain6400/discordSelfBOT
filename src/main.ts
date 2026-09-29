import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Punto de entrada principal de la aplicación NestJS.
 * Al tratarse de un bot/servicio en segundo plano sin endpoints HTTP requeridos,
 * se utiliza createApplicationContext para un arranque eficiente y liviano.
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.createApplicationContext(AppModule);

    // Permitir cierre limpio de conexiones ante señales SIGINT o SIGTERM (Ctrl + C)
    app.enableShutdownHooks();

    logger.log('Aplicación NestJS iniciada correctamente.');
  } catch (error: any) {
    logger.error(`Error crítico durante el inicio de la aplicación: ${error?.message || error}`, error?.stack);
    process.exit(1);
  }
}

bootstrap();
