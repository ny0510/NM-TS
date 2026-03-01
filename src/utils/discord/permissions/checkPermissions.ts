import {type BaseInteraction, ChatInputCommandInteraction, type GuildMember, type PermissionResolvable, type VoiceBasedChannel} from 'discord.js';

import type {Command} from '@/client/types';

export interface PermissionResult {
  result: boolean;
  missing: string[];
}

export const checkBotPermissions = async (interaction: BaseInteraction, requiredPermissions: PermissionResolvable[], voiceChannel?: VoiceBasedChannel | null): Promise<PermissionResult> => {
  const member = await interaction.guild!.members.fetch(interaction.client.user!.id);
  let missing = member.permissions.missing(requiredPermissions);

  if (voiceChannel) {
    const botVoicePerms = voiceChannel.permissionsFor(member);

    if (botVoicePerms) {
      const voiceMissing = botVoicePerms.missing(requiredPermissions);
      missing = [...missing, ...voiceMissing];
    }
  }

  missing = [...new Set(missing)];
  return {result: missing.length === 0, missing};
};

export const checkPermissions = async (interaction: ChatInputCommandInteraction, command: Command): Promise<PermissionResult> => {
  if (!command.permissions) return {result: true, missing: []};

  const voiceChannel = interaction.member && 'voice' in interaction.member && interaction.member.voice?.channel ? interaction.member.voice.channel : null;

  return await checkBotPermissions(interaction, command.permissions as PermissionResolvable[], voiceChannel);
};
