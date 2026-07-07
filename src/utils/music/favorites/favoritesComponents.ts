import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextDisplayBuilder} from 'discord.js';
import type {MessageActionRowComponentBuilder} from 'discord.js';

import {msToTime, truncateWithEllipsis} from '@/utils/formatting';
import type {getUserFavorites} from '@/utils/music/favorites/favoritesService';

export const FAVORITES_PER_PAGE = 5;

type Favorites = Awaited<ReturnType<typeof getUserFavorites>>;
type FavoritesMessageComponent = ContainerBuilder;

export function buildFavoritesContainer(favorites: Favorites, page: number, totalPages: number, nonce: string): ContainerBuilder {
  const container = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent('### ⭐️ 즐겨찾기 목록'));

  if (favorites.length === 0) {
    return container.addTextDisplayComponents(new TextDisplayBuilder().setContent('> 즐겨찾기에 추가한 곡이 없어요.\n> 재생 중인 음악 아래 ⭐ 버튼을 눌러 추가해 보세요!'));
  }

  const start = page * FAVORITES_PER_PAGE;
  const pageFavorites = favorites.slice(start, start + FAVORITES_PER_PAGE);

  pageFavorites.forEach((fav, i) => {
    const index = start + i + 1;
    const section = new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${index}. **${truncateWithEllipsis(fav.title, 40)}**\n┕ ${msToTime(fav.durationMs)} | ${truncateWithEllipsis(fav.artist, 30)}`))
      .setButtonAccessory(new ButtonBuilder().setCustomId(`fav_remove_confirm_${page}_${fav.trackId}_${nonce}`).setLabel('삭제').setStyle(ButtonStyle.Danger));

    container.addSectionComponents(section);

    // if (i < pageFavorites.length - 1) {
    //   container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    // }
  });

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`\n-# ${page + 1}/${totalPages} 페이지 · 총 ${favorites.length}곡`));
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  const selectMenu = new StringSelectMenuBuilder().setCustomId(`fav_select_${page}_${nonce}`).setPlaceholder('재생할 곡을 선택하세요').setMinValues(1).setMaxValues(pageFavorites.length);

  pageFavorites.forEach(fav => {
    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(truncateWithEllipsis(fav.title, 50))
        .setDescription(`${truncateWithEllipsis(fav.artist, 45)} (${msToTime(fav.durationMs)})`)
        .setValue(`${fav.trackId}`),
    );
  });

  container.addActionRowComponents(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(selectMenu));

  const paginationRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`fav_page_${page - 1}_${nonce}`)
      .setEmoji({name: '◀️'})
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`fav_page_jump_${nonce}`)
      .setLabel(`${page + 1}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(totalPages <= 1),
    new ButtonBuilder()
      .setCustomId(`fav_page_${page + 1}_${nonce}`)
      .setEmoji({name: '▶️'})
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
    new ButtonBuilder().setCustomId(`fav_refresh_${nonce}`).setLabel('새로고침').setEmoji({name: '🔄'}).setStyle(ButtonStyle.Primary),
  );

  container.addActionRowComponents(paginationRow);

  return container;
}

export function buildFavoritesComponents(favorites: Favorites, page: number, nonce?: string): FavoritesMessageComponent[] {
  const totalPages = Math.max(1, Math.ceil(favorites.length / FAVORITES_PER_PAGE));
  const validPage = Math.min(Math.max(page, 0), totalPages - 1);
  const resolvedNonce = nonce ?? Date.now().toString(36);

  return [buildFavoritesContainer(favorites, validPage, totalPages, resolvedNonce)];
}
