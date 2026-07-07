import {MessageFlags, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/types/client';
import {safeReply} from '@/utils/discord';
import {buildFavoritesComponents} from '@/utils/music/favorites/favoritesComponents';
import {getUserFavorites} from '@/utils/music/favorites/favoritesService';

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
