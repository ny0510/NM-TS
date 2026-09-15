import type {BaseInteraction} from 'discord.js';

import type {NMClient} from '@/client';

export const getClient = (interaction: BaseInteraction): NMClient => {
  return interaction.client as NMClient;
};
