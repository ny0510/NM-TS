import {type AutocompleteInteraction, BaseInteraction, ChatInputCommandInteraction, EmbedBuilder, Events, MessageFlags, type PermissionsString, codeBlock} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Event} from '@/client/types';
import {slashCommandMention} from '@/utils/discord';
import {isInteractionProcessed} from '@/utils/discord/interactions';
import {safeReply} from '@/utils/discord/interactions';
import {checkPermissions} from '@/utils/discord/permissions';
import PermissionTranslations from '@/utils/discord/permissions/locale/permission';
import {handlePlayerControlsButtons} from '@/utils/music/buttons/controlsButton';
import {handleQuickAddButton} from '@/utils/music/buttons/quickAddButton';

export default {
  name: Events.InteractionCreate,
  async execute(interaction: BaseInteraction): Promise<void> {
    const client = interaction.client as NMClient;

    // 버튼 인터랙션 처리
    if (interaction.isButton()) {
      if (interaction.customId === 'quick_add') {
        await handleQuickAddButton(interaction);
      } else if (interaction.customId.startsWith('control_')) {
        await handlePlayerControlsButtons(interaction);
      }
      return;
    }

    // Autocomplete 인터랙션 처리
    if (interaction.isAutocomplete()) {
      const command = client.services.commandManager.getCommand(interaction.commandName);

      if (command && command.autocomplete) {
        try {
          await command.autocomplete(interaction as AutocompleteInteraction);
        } catch (error) {
          client.logger.error(`Error executing autocomplete for ${interaction.commandName}: ${error}`);
        }
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    if (!interaction.channel?.isSendable()) return;
    if (!interaction.client.user) return;
    if (!interaction.guild) return await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle('DM에서는 사용할 수 없어요.').setColor(client.config.EMBED_COLOR_ERROR)], flags: MessageFlags.Ephemeral});

    // 이미 처리된 인터랙션인지 확인
    if (isInteractionProcessed(interaction.id)) {
      client.logger.warn(`Duplicate interaction detected: ${interaction.id}`);
      return;
    }

    const command = client.services.commandManager.getCommand(interaction.commandName);

    if (!command) return;

    // Cooldown Check
    const cooldownResult = client.services.cooldownManager.checkCooldown(command.data.name, interaction.user.id, command.cooldown);

    if (cooldownResult.onCooldown) {
      return await safeReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setTitle('잠시 후에 다시 시도해 주세요.')
            .setDescription(`${await slashCommandMention(interaction, command.data.name)} 명령어는 \`${cooldownResult.timeLeft}초\` 후에 사용할 수 있어요.`)
            .setColor(client.config.EMBED_COLOR_ERROR),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    // Permission Check
    const {result, missing} = await checkPermissions(interaction as ChatInputCommandInteraction, command);
    if (!result) {
      const missingPermissions = missing.map(permission => `+ ${PermissionTranslations[permission as PermissionsString]} (${permission})`).join('\n');
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

      // 이미 응답되었는지 확인 후 응답
      if (!interaction.replied && !interaction.deferred) {
        if (client.config.IS_DEV_MODE) {
          await safeReply(interaction, {
            content: `명령어를 실행하는 도중 오류가 발생했어요.\n${codeBlock('js', `${e}`)}`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await safeReply(interaction, {content: '명령어를 실행하는 도중 오류가 발생했어요.', flags: MessageFlags.Ephemeral});
        }
      }
    }
  },
} as Event;
