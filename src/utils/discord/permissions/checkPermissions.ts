import {ChatInputCommandInteraction, type PermissionResolvable} from 'discord.js';

import type {Command} from '@/client/types';

export interface PermissionResult {
  result: boolean;
  missing: string[];
}

export const checkPermissions = async (interaction: ChatInputCommandInteraction, command: Command): Promise<PermissionResult> => {
  if (!command.permissions) return {result: true, missing: []};

  const member = await interaction.guild!.members.fetch(interaction.client.user!.id);
  const required = command.permissions as PermissionResolvable[];
  let missing = member.permissions.missing(required);

  // 음성 채널에 있는 경우, 음성 채널의 권한도 확인
  if (interaction.member && 'voice' in interaction.member && interaction.member.voice?.channel) {
    const botVoicePerms = interaction.member.voice.channel.permissionsFor(member);
    missing = [...missing, ...botVoicePerms.missing(required)];
  }

  missing = [...new Set(missing)];
  return {result: missing.length === 0, missing};
};
