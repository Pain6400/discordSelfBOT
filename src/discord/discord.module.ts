import { Module } from '@nestjs/common';
import { DiscordService } from './discord.service';
import { NicknameService } from './nickname.service';

/**
 * Módulo de Discord que encapsula el cliente y el servicio de gestión de apodos.
 */
@Module({
  providers: [DiscordService, NicknameService],
  exports: [DiscordService, NicknameService],
})
export class DiscordModule {}
