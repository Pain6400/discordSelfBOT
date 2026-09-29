import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, GuildMember, PartialGuildMember } from 'discord.js-selfbot-v13';

/**
 * Servicio encargado de gestionar y restaurar el apodo del usuario
 * en los servidores configurados cuando se detecte un cambio no deseado.
 */
@Injectable()
export class NicknameService {
  private readonly logger = new Logger(NicknameService.name);

  // ID del usuario objetivo a vigilar (tu cuenta)
  private myUserId: string;

  // Apodo que se desea forzar y mantener
  private readonly desiredNickname: string;

  // Conjunto de IDs de servidores (Guilds) vigilados para búsqueda O(1)
  private readonly watchedGuilds: Set<string>;

  // Retardo de espera en milisegundos antes de restaurar el apodo
  private readonly restoreDelayMs: number;

  // Evita ejecuciones concurrentes en un mismo servidor
  private readonly restoringGuilds = new Set<string>();

  // Referencia al cliente para operaciones directas
  private client: Client | null = null;

  constructor(private readonly configService: ConfigService) {
    this.myUserId = this.configService.get<string>('MI_USER_ID')?.trim() || '';
    this.desiredNickname = this.configService.get<string>('DESIRED_NICKNAME') || '';

    // Cargar y sanitizar la lista de servidores vigilados desde el .env
    const watchedGuildsRaw = this.configService.get<string>('WATCHED_GUILDS') || '';
    const guildIds = watchedGuildsRaw
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    this.watchedGuilds = new Set(guildIds);

    // Retardo por defecto de 1500ms si no se especifica
    const delayConfig = this.configService.get<string>('RESTORE_DELAY_MS');
    this.restoreDelayMs = delayConfig ? Number(delayConfig) : 1500;

    this.logger.log(`NicknameService inicializado.`);
    this.logger.log(`Apodo deseado: "${this.desiredNickname}"`);
    this.logger.log(`Servidores vigilados: [${Array.from(this.watchedGuilds).join(', ')}]`);
    this.logger.log(`Delay de restauración: ${this.restoreDelayMs}ms`);
  }

  /**
   * Vincula el cliente conectado y auto-corrige el ID del usuario en caso de error en .env
   * También pre-carga la caché y verifica el apodo actual en los servidores vigilados.
   */
  async initSession(client: Client): Promise<void> {
    this.client = client;
    const realUserId = client.user?.id;

    if (!realUserId) return;

    if (this.myUserId !== realUserId) {
      if (this.myUserId) {
        this.logger.warn(
          `[AUTO-CORRECCIÓN] El MI_USER_ID en tu .env (${this.myUserId}) no coincidía con tu cuenta conectada (${realUserId}).\n` +
            `  -> Se ha corregido automáticamente para vigilar a tu usuario real: "${client.user?.tag}".`,
        );
      }
      this.myUserId = realUserId;
    } else {
      this.logger.log(`[USUARIO CONFIRMADO] Vigilando a tu usuario: ${client.user?.tag} (${this.myUserId})`);
    }

    // Pre-cargar caché y verificar apodo inicial en cada servidor vigilado
    for (const guildId of this.watchedGuilds) {
      try {
        const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
        if (!guild) {
          this.logger.warn(
            `[ADVERTENCIA] No se pudo encontrar el servidor con ID ${guildId}. ¿Tu cuenta sigue dentro de ese servidor?`,
          );
          continue;
        }

        const member = await guild.members.fetch(this.myUserId).catch(() => null);
        if (member) {
          const currentNick = member.nickname ?? member.user.username;
          this.logger.log(
            `[VIGILANDO] Servidor "${guild.name}" (${guild.id}) - Tu apodo actual es: "${currentNick}"`,
          );

          // Si el apodo ya difiere al iniciar el bot, restaurarlo de inmediato
          if (member.nickname !== this.desiredNickname) {
            this.logger.warn(
              `[INICIO] Tu apodo en "${guild.name}" no es el deseado ("${this.desiredNickname}"). Restaurando...`,
            );
            await this.restoreNickname(member, currentNick);
          }
        }
      } catch (err: any) {
        this.logger.error(`Error al verificar servidor ${guildId}: ${err?.message || err}`);
      }
    }
  }

  /**
   * Procesa la actualización de un miembro del servidor.
   *
   * @param oldMember Estado del miembro antes de la actualización (puede ser parcial)
   * @param newMember Estado del miembro después de la actualización
   */
  async handleMemberUpdate(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember,
  ): Promise<void> {
    try {
      // 1. Verificar si el evento pertenece a nuestro usuario
      if (newMember.id !== this.myUserId) {
        return;
      }

      // 2. Verificar si el servidor está en la lista de servidores vigilados
      const guildId = newMember.guild.id;
      const guildName = newMember.guild.name;

      if (!this.watchedGuilds.has(guildId)) {
        return;
      }

      const oldNick = oldMember.nickname ?? null;
      const newNick = newMember.nickname ?? null;

      // 3. Ignorar eventos que no hayan modificado el apodo
      if (oldNick === newNick) {
        return;
      }

      // 4. Comprobar si el nuevo apodo ya es el deseado
      if (newNick === this.desiredNickname) {
        this.logger.log(
          `[${guildName}] El apodo ya coincide con el deseado ("${this.desiredNickname}"). No se requiere acción.`,
        );
        return;
      }

      const oldNickDisplay = oldNick ?? `(Sin apodo / Nombre base: ${oldMember.user.username})`;
      await this.restoreNickname(newMember, oldNickDisplay, newNick);
    } catch (error: any) {
      this.logger.error(
        `[ERROR] Fallo en handleMemberUpdate para "${newMember.guild?.name || newMember.guild?.id}": ${
          error?.message || error
        }`,
      );
    }
  }

  /**
   * Respaldo para eventos de Gateway directos (raw).
   * Asegura que ningún cambio se pierda incluso si discord.js no emitió guildMemberUpdate por caché.
   */
  async handleRawPacket(packet: any): Promise<void> {
    if (packet.t !== 'GUILD_MEMBER_UPDATE' || !packet.d) return;

    const data = packet.d;
    const targetUserId = data.user?.id;
    const guildId = data.guild_id;

    if (targetUserId !== this.myUserId || !this.watchedGuilds.has(guildId)) {
      return;
    }

    const newNick = data.nick ?? null;
    if (newNick === this.desiredNickname) {
      return;
    }

    if (this.restoringGuilds.has(guildId)) {
      return;
    }

    if (this.client) {
      const guild = this.client.guilds.cache.get(guildId) || (await this.client.guilds.fetch(guildId).catch(() => null));
      if (guild) {
        const member = await guild.members.fetch(this.myUserId).catch(() => null);
        if (member && member.nickname !== this.desiredNickname) {
          this.logger.warn(`[RAW GATEWAY] Cambio detectado por paquete directo en "${guild.name}".`);
          await this.restoreNickname(member, '(Desconocido por raw)', newNick);
        }
      }
    }
  }

  /**
   * Ejecuta la restauración del apodo con control de concurrencia y delay de seguridad.
   */
  private async restoreNickname(
    member: GuildMember,
    previousNickDisplay: string,
    newNickDisplay?: string | null,
  ): Promise<void> {
    const guildId = member.guild.id;
    const guildName = member.guild.name;

    if (this.restoringGuilds.has(guildId)) {
      return;
    }

    this.restoringGuilds.add(guildId);

    try {
      const targetDisplay = newNickDisplay ?? member.nickname ?? member.user.username;

      this.logger.warn(
        `[DETECCIÓN] ¡Cambio de apodo detectado en el servidor "${guildName}" (${guildId})!\n` +
          `  -> Apodo anterior: "${previousNickDisplay}"\n` +
          `  -> Apodo actual detectado: "${targetDisplay}"\n` +
          `  -> Apodo deseado: "${this.desiredNickname}"\n` +
          `  -> Esperando ${this.restoreDelayMs}ms antes de restaurar...`,
      );

      if (this.restoreDelayMs > 0) {
        await this.sleep(this.restoreDelayMs);
      }

      await member.setNickname(this.desiredNickname, 'Restauración automática de apodo por Selfbot');

      this.logger.log(
        `[ÉXITO] ¡Apodo restaurado exitosamente a "${this.desiredNickname}" en el servidor "${guildName}"!`,
      );
    } catch (error: any) {
      this.logger.error(
        `[ERROR] Fallo al intentar restaurar el apodo en "${guildName}": ${error?.message || error}`,
      );
    } finally {
      this.restoringGuilds.delete(guildId);
    }
  }

  /**
   * Pausa la ejecución de forma asíncrona.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
