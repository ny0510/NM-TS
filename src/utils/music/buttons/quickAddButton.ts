import {ButtonInteraction, MessageFlags, PermissionsBitField, codeBlock} from 'discord.js';

import {getClient} from '@/utils/discord/client';
import {createErrorEmbed} from '@/utils/discord/embeds';
import {checkBotPermissions, formatMissingPermissions} from '@/utils/discord/permissions';
import {Logger} from '@/utils/logger';
import {createQuickAddButton} from '@/utils/music/buttons/quickAddButtonComponent';
import {addTrackToQueue} from '@/utils/music/trackAdder';

export {createQuickAddButton};

const logger = new Logger('QuickAdd');

export async function handleQuickAddButton(interaction: ButtonInteraction): Promise<void> {
  const client = getClient(interaction);

  const userMember = interaction.guild?.members.cache.get(interaction.user.id);
  const voiceChannel = userMember?.voice.channel;

  const requiredPermissions = [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak];
  const {result, missing} = await checkBotPermissions(interaction, requiredPermissions, voiceChannel);

  if (!result) {
    const missingPermissionsText = formatMissingPermissions(missing);
    await interaction.reply({
      embeds: [createErrorEmbed(client, '명령어를 실행하기 위해 필요한 권한이 부족해요. 아래 권한을 추가해 주세요.', codeBlock('diff', missingPermissionsText))],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const url = interaction.message.embeds[0]?.url;
  if (!url) {
    await interaction.reply({
      embeds: [createErrorEmbed(client, '음악 URL을 찾을 수 없어요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!voiceChannel) {
    await interaction.reply({
      embeds: [createErrorEmbed(client, '먼저 음성 채널에 들어가 주세요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({flags: MessageFlags.Ephemeral});

  try {
    await addTrackToQueue(client, interaction, {query: url, source: 'quick_add'});
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error(`Quick add error: ${error}`));
    await interaction.editReply({
      embeds: [createErrorEmbed(client, '음악을 추가하는 중 오류가 발생했어요.')],
    });
  }
}
