import {ActionRowBuilder, ButtonBuilder, ButtonStyle} from 'discord.js';

export function createQuickAddButton(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('quick_add').setLabel('다시 추가').setEmoji('➕').setStyle(ButtonStyle.Secondary));
}
