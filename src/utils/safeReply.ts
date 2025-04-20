import {ButtonInteraction, CommandInteraction, type InteractionReplyOptions} from 'discord.js';

import type {NMClient} from '@/structs/Client';

export async function safeReply(interaction: CommandInteraction | ButtonInteraction, content: string | InteractionReplyOptions, options?: InteractionReplyOptions): Promise<void> {
  const client = interaction.client as NMClient;
  try {
    let replyOptions: InteractionReplyOptions;
    if (typeof content === 'string') replyOptions = {content, ...options};
    else replyOptions = content;

    if (interaction.deferred || interaction.replied) await interaction.followUp(replyOptions);
    else await interaction.reply(replyOptions);
  } catch (error) {
    client.logger.error(`Failed to reply to interaction: ${error}`);
  }
}
