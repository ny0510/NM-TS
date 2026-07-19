import {ActionRowBuilder, ButtonBuilder, ButtonStyle, type ChatInputCommandInteraction, EmbedBuilder, type Message} from 'discord.js';
import {RESTJSONErrorCodes} from 'discord-api-types/v10';

import type {NMClient} from '@/client/Client';
import {slashCommandMention} from '@/shared/discord';
import {COLORS} from '@/shared/discord/embedColors';
import {toError} from '@/shared/errors';

export function buildQueueButtons(page: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('queue_previous')
      .setEmoji('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId('queue_page')
      .setLabel(`${page}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(totalPages <= 1),
    new ButtonBuilder()
      .setCustomId('queue_next')
      .setEmoji('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages),
    new ButtonBuilder().setCustomId('queue_refresh').setLabel('새로고침').setEmoji('🔄').setStyle(ButtonStyle.Primary),
  );
}

export async function disableQueueComponents(
  interaction: ChatInputCommandInteraction,
  client: NMClient,
): Promise<void> {
  try {
    const message = await interaction.fetchReply().catch(() => null);
    if (message) {
      await message.edit({
        embeds: [
          new EmbedBuilder()
            .setTitle(`만료된 인터렉션이에요. ${await slashCommandMention(interaction, 'queue')} 명령어를 사용해 다시 확인해 주세요.`)
            .setColor(COLORS.normal),
        ],
        components: [],
      });
    }
  } catch (error) {
    const code = (error as {code?: number})?.code;
    if (code === RESTJSONErrorCodes.UnknownMessage || code === RESTJSONErrorCodes.MissingAccess) {
      client.logger.debug(`Failed to edit message (known error ${code}): ${error}`);
    } else {
      client.logger.error(toError(error, 'Failed to edit message'));
    }
  }
}
