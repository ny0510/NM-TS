import {type ChatInputCommandInteraction, ContainerBuilder, MessageFlags, resolveColor, TextDisplayBuilder} from 'discord.js';
import {RESTJSONErrorCodes} from 'discord-api-types/v10';

import type {NMClient} from '@/client/Client';
import {slashCommandMention} from '@/shared/discord';
import {COLORS} from '@/shared/discord/embedColors';
import {toError} from '@/shared/errors';

export async function disableQueueComponents(
  interaction: ChatInputCommandInteraction,
  client: NMClient,
): Promise<void> {
  try {
    const message = await interaction.fetchReply().catch(() => null);
    if (message) {
      const container = new ContainerBuilder()
        .setAccentColor(resolveColor(COLORS.normal))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `> 만료된 인터렉션이에요. ${await slashCommandMention(interaction, 'queue')} 명령어를 사용해 다시 확인해 주세요.`,
        ));
      await message.edit({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
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
