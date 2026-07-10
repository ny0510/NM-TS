import {type ChatInputCommandInteraction, EmbedBuilder, type MessageComponentInteraction, MessageFlags} from 'discord.js';
import {RESTJSONErrorCodes} from 'discord-api-types/v10';

import type {NMClient} from '@/client/Client';
import {slashCommandMention} from '@/shared/discord';
import {createErrorEmbed} from '@/shared/discord/embeds';
import {toError} from '@/shared/errors';

export {handleChartCollect} from './handler';
export {handleChartCollectError} from './errorHandler';
export type {MutablePage, MutableRanking, MutableTotalPages} from './types';

export function createChartFilter(interaction: ChatInputCommandInteraction, client: NMClient) {
  return async (i: MessageComponentInteraction) => {
    if (!i.customId.startsWith('chart_')) return false;

    if (i.user.id !== interaction.user.id) {
      try {
        if (!i.replied && !i.deferred) {
          await i.reply({
            embeds: [createErrorEmbed(client, '다른 사용자의 인터렉션이에요.', `${await slashCommandMention(interaction, 'chart')} 명령어로 차트를 확인할 수 있어요.`)],
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (error) {
        client.logger.warn(`Filter reply error: ${error}`);
      }
      return false;
    }

    return true;
  };
}

export async function disableChartComponents(
  interaction: ChatInputCommandInteraction,
  client: NMClient,
): Promise<void> {
  try {
    const message = await interaction.fetchReply().catch(() => null);
    if (message) {
      await message.edit({
        embeds: [new EmbedBuilder().setTitle(`만료된 인터렉션이에요. ${await slashCommandMention(interaction, 'chart')} 명령어를 사용해 다시 확인해 주세요.`)],
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
