import {MessageFlags, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/types/client';
import {safeReply} from '@/shared/discord';
import {buildFavoritesComponents} from '@/features/favorites/componentBuilder';
import {getUserFavorites} from '@/features/favorites/service';

export default {
  data: new SlashCommandBuilder().setName('favorites').setDescription('내 즐겨찾기 목록을 확인해요.'),
  async execute(interaction) {
    const favorites = await getUserFavorites(interaction.user.id);

    await safeReply(interaction, {
      components: buildFavoritesComponents(favorites, 0),
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  },
} satisfies Command;
