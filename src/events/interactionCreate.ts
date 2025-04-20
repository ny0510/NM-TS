import {BaseInteraction, ChatInputCommandInteraction, Collection, EmbedBuilder, Events, MessageFlags, type PermissionsString, channelMention, codeBlock} from 'discord.js';
import {DateTime} from 'luxon';

import type {Event} from '@/interfaces/Event';
import type {NMClient} from '@/structs/Client';
import {checkPermissions} from '@/utils/checkPermissions';
import PermissionTranslations from '@/utils/locale/permission';
import {slashCommandMention} from '@/utils/mention';
import {safeReply} from '@/utils/safeReply';

export default {
  name: Events.InteractionCreate,
  async execute(interaction: BaseInteraction): Promise<void> {
    const client = interaction.client as NMClient;

    if (!interaction.isChatInputCommand()) return;
    if (!interaction.channel?.isSendable()) return;
    if (!interaction.client.user) return;
    if (!interaction.guild) return await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle('DM에서는 사용할 수 없어요.').setColor(client.config.EMBED_COLOR_ERROR)], flags: MessageFlags.Ephemeral});

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    if (!client.cooldowns.has(command.data.name)) {
      client.cooldowns.set(command.data.name, new Collection());
    }

    // Cooldown Check
    const now = DateTime.now().toMillis();
    const timestamps = client.cooldowns.get(command.data.name)!;
    const cooldownAmount = (command.cooldown || 1) * 1000;
    const timestamp = timestamps.get(interaction.user.id);

    if (timestamp) {
      const expirationTime = timestamp + cooldownAmount;

      if (now < expirationTime) {
        const timeLeft = expirationTime - now;
        return await safeReply(interaction, {
          embeds: [
            new EmbedBuilder()
              .setTitle('잠시 후에 다시 시도해 주세요.')
              .setDescription(`${await slashCommandMention(interaction, command.data.name)} 명령어는 \`${Math.ceil(timeLeft / 1000)}초\` 후에 사용할 수 있어요.`)
              .setColor(client.config.EMBED_COLOR_ERROR),
          ],
          flags: MessageFlags.Ephemeral,
        });
      }
    }
    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    // Permission Check
    const {result, missing} = await checkPermissions(interaction as ChatInputCommandInteraction, command);
    if (!result) {
      const missingPermissions = missing.map(permission => `+ ${permission} (${PermissionTranslations[permission as PermissionsString]})`).join('\n');
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('명령어를 실행하기 위해 필요한 권한이 부족해요. 아래 권한을 추가해 주세요.').setDescription(codeBlock('diff', missingPermissions)).setColor(client.config.EMBED_COLOR_ERROR)],
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      await command.execute(interaction);
    } catch (e) {
      client.logger.error(`Error executing command ${interaction.commandName}: ${e}`);
      console.error(e);

      if (client.config.IS_DEV_MODE) {
        return await safeReply(interaction, {
          content: `명령어를 실행하는 도중 오류가 발생했어요.\n${codeBlock('js', `${e}`)}`,
          flags: MessageFlags.Ephemeral,
        });
      }
      await safeReply(interaction, {content: '명령어를 실행하는 도중 오류가 발생했어요.', flags: MessageFlags.Ephemeral});
    }
  },
} as Event;
