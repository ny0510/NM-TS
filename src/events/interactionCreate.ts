import {type AutocompleteInteraction, type ChatInputCommandInteraction, EmbedBuilder, Events, type Interaction, MessageFlags, type PermissionsString, codeBlock} from 'discord.js';

import type {Event} from '@/types/client';
import {slashCommandMention} from '@/shared/discord';
import {getClient} from '@/shared/discord/client';
import {getColors} from '@/shared/discord/embedColors';
import {isInteractionProcessed} from '@/shared/discord/interactions';
import {safeReply} from '@/shared/discord/interactions';
import {checkPermissions} from '@/shared/discord/permissions';
import {toError} from '@/shared/errors';
import PermissionTranslations from '@/shared/discord/permissions/locale/permission';
import {handlePlayerControlsButtons} from '@/features/music/button/controls';
import {handleFavToggleButton} from '@/features/favorites/button';
import {handleFavoritesPagination, handleFavoritesSelectMenu} from '@/features/favorites/interaction';
import {handleQuickAddButton} from '@/features/music/button/quickAdd';

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction): Promise<void> {
    const client = getClient(interaction);

    if (interaction.isButton()) {
      if (interaction.customId === 'quick_add') {
        await handleQuickAddButton(interaction);
      } else if (interaction.customId.startsWith('control_')) {
        await handlePlayerControlsButtons(interaction);
      } else if (interaction.customId === 'fav_toggle') {
        await handleFavToggleButton(interaction);
      } else if (interaction.customId.startsWith('fav_page_') || interaction.customId.startsWith('fav_remove_') || interaction.customId.startsWith('fav_refresh_')) {
        await handleFavoritesPagination(interaction);
      }
      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('fav_select_')) {
        await handleFavoritesSelectMenu(interaction);
      }
      return;
    }

    if (interaction.isAutocomplete()) {
      const command = client.services.commandManager.getCommand(interaction.commandName);

      if (command && command.autocomplete) {
        try {
          await command.autocomplete(interaction as AutocompleteInteraction);
        } catch (error) {
          client.logger.error(toError(error, `Error executing autocomplete for ${interaction.commandName}`));
        }
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    if (!interaction.channel?.isSendable()) return;
    if (!interaction.client.user) return;
    if (!interaction.guild) return await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle('DM에서는 사용할 수 없어요.').setColor(getColors(client.config).error)], flags: MessageFlags.Ephemeral});

    if (isInteractionProcessed(interaction.id)) {
      client.logger.warn(`Duplicate interaction detected: ${interaction.id}`);
      return;
    }

    const command = client.services.commandManager.getCommand(interaction.commandName);

    if (!command) return;

    const cooldownResult = client.services.cooldownManager.checkCooldown(command.data.name, interaction.user.id, command.cooldown);

    if (cooldownResult.onCooldown) {
      return await safeReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setTitle('잠시 후에 다시 시도해 주세요.')
            .setDescription(`${await slashCommandMention(interaction, command.data.name)} 명령어는 \`${cooldownResult.timeLeft}초\` 후에 사용할 수 있어요.`)
            .setColor(getColors(client.config).error),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const {result, missing} = await checkPermissions(interaction as ChatInputCommandInteraction, command);
    if (!result) {
      const missingPermissions = missing.map(permission => `+ ${PermissionTranslations[permission as PermissionsString]} (${permission})`).join('\n');
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('명령어를 실행하기 위해 필요한 권한이 부족해요. 아래 권한을 추가해 주세요.').setDescription(codeBlock('diff', missingPermissions)).setColor(getColors(client.config).error)],
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      await command.execute(interaction);
    } catch (e) {
      client.logger.error(toError(e, `Error executing command ${interaction.commandName}`));

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
} satisfies Event<'interactionCreate'>;
