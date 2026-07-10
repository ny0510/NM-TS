import {type AutocompleteInteraction, DiscordAPIError} from 'discord.js';
import {RESTJSONErrorCodes} from 'discord-api-types/v10';

import {getClient} from '@/shared/discord/client';
import {toError} from '@/shared/errors';

export async function safeRespondAutocomplete(
  interaction: AutocompleteInteraction,
  choices: {name: string; value: string}[],
  debugMessage?: string,
): Promise<void> {
  try {
    await interaction.respond(choices);
  } catch (error) {
    const client = getClient(interaction);

    if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownInteraction) {
      client.logger.debug('Autocomplete interaction expired before response could be sent.');
      return;
    }

    client.logger.error(toError(error, debugMessage ?? 'Failed to respond to autocomplete interaction'));
  }
}
