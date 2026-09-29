import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'discord.js-selfbot-v13';
import { NicknameService } from './nickname.service';

/**
 * Servicio principal del cliente de Discord Selfbot.
 * Gestiona el ciclo de vida del cliente, la conexión y el enrutamiento de eventos.
 */
@Injectable()
export class DiscordService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordService.name);
  private client: Client;

  constructor(
    private readonly configService: ConfigService,
    private readonly nicknameService: NicknameService,
  ) {
    this.client = new Client();
  }

  /**
   * Ciclo de vida de NestJS: Se ejecuta al inicializar el módulo.
   * Configura los escuchadores de eventos e inicia sesión con el token.
   */
  async onModuleInit(): Promise<void> {
    const token = this.configService.get<string>('DISCORD_USER_TOKEN')?.trim();

    if (!token) {
      this.logger.error(
        'DISCORD_USER_TOKEN no está definido en el archivo .env. El selfbot no puede iniciar.',
      );
      return;
    }

    this.registerEvents();

    try {
      this.logger.log('Iniciando sesión en Discord con el token de usuario...');
      await this.client.login(token);
    } catch (error: any) {
      if (
        error?.message?.includes('INVALID_INTENTS') ||
        error?.message?.includes('[Bot Token]')
      ) {
        this.logger.error(
          `\n=======================================================\n` +
            `[TOKEN INCORRECTO] Has configurado un TOKEN DE BOT (Discord Developer Portal).\n` +
            `Este proyecto es un SELFBOT y requiere tu TOKEN DE USUARIO PERSONAL.\n` +
            `Discord rechaza los bots que no envían Gateway Intents, mientras que las cuentas de usuario no usan intents.\n` +
            `Por favor, obtén tu token de usuario desde las DevTools de Discord Web (F12 -> Red/Network -> Authorization) y colócalo en DISCORD_USER_TOKEN.\n` +
            `=======================================================`,
        );
      } else {
        this.logger.error(
          `Error al intentar autenticar el selfbot en Discord: ${error?.message || error}`,
          error?.stack,
        );
      }
    }
  }

  /**
   * Registra los manejadores de eventos del cliente de Discord.
   */
  private registerEvents(): void {
    // Evento de conexión exitosa
    this.client.on('ready', async () => {
      this.logger.log(`=======================================================`);
      this.logger.log(
        `[CONECTADO] Selfbot listo y activo como: ${this.client.user?.tag} (ID: ${this.client.user?.id})`,
      );
      this.logger.log(`[ESTADO] Conectado a ${this.client.guilds.cache.size} servidores.`);
      this.logger.log(`[VIGILANCIA] Inicializando sesión y monitores de apodos...`);
      this.logger.log(`=======================================================`);

      // Inicializar sesión en NicknameService (auto-detecta ID real y verifica apodo actual)
      await this.nicknameService.initSession(this.client);
    });

    // Evento disparado cuando se actualiza un miembro en un servidor
    this.client.on('guildMemberUpdate', async (oldMember, newMember) => {
      await this.nicknameService.handleMemberUpdate(oldMember, newMember);
    });

    // Evento crudo del WebSocket como capa de respaldo por si discord.js no emite el evento
    this.client.on('raw', async (packet) => {
      await this.nicknameService.handleRawPacket(packet);
    });

    // Manejo de errores de conexión o del WebSocket
    this.client.on('error', (error) => {
      this.logger.error(`Error en el cliente de Discord: ${error.message}`, error.stack);
    });

    // Aviso de advertencias del cliente
    this.client.on('warn', (warning) => {
      this.logger.warn(`Advertencia de Discord: ${warning}`);
    });
  }

  /**
   * Obtiene la instancia subyacente del cliente de Discord.
   */
  getClient(): Client {
    return this.client;
  }

  /**
   * Ciclo de vida de NestJS: Se ejecuta al destruir o detener la aplicación.
   */
  onModuleDestroy(): void {
    if (this.client) {
      this.logger.log('Desconectando cliente de Discord Selfbot...');
      this.client.destroy();
      this.logger.log('Cliente desconectado satisfactoriamente.');
    }
  }
}
