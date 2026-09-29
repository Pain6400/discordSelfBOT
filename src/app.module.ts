import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscordModule } from './discord/discord.module';

/**
 * Módulo raíz de la aplicación NestJS.
 * Carga las variables de entorno de forma global y los submódulos.
 */
@Module({
  imports: [
    // Configuración global de variables de entorno (.env)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Módulo de integración con Discord
    DiscordModule,
  ],
})
export class AppModule {}
