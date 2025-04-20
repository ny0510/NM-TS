import type {ChatInputCommandInteraction} from 'discord.js';

export const slashCommandMention = async (interaction: ChatInputCommandInteraction, commandName: string): Promise<string> => {
  const guildCommand = await interaction.guild?.commands.fetch().then(commands => commands.find(cmd => cmd.name === commandName));
  const globalCommand = await interaction.client.application?.commands.fetch().then(commands => commands.find(cmd => cmd.name === commandName));
  return `</${commandName}:${guildCommand?.id || globalCommand?.id || ''}>`;
};

// export const user = async (interaction: ChatInputCommandInteraction, userId: string): Promise<string> => {
//   const user = await interaction.client.users.fetch(userId);
//   return `<@${user.id}>`;
// };

// export const role = async (interaction: ChatInputCommandInteraction, roleId: string): Promise<string> => {
//   const role = await interaction.guild?.roles.fetch(roleId);
//   return `<@&${role?.id}>`;
// };

// export const channel = async (interaction: ChatInputCommandInteraction, channelId: string): Promise<string> => {
//   const channel = await interaction.guild?.channels.fetch(channelId);
//   return `<#${channel?.id}>`;
// };

// export const emoji = async (interaction: ChatInputCommandInteraction, emojiId: string): Promise<string> => {
//   const emoji = await interaction.guild?.emojis.fetch(emojiId);
//   return `<:${emoji?.name}:${emoji?.id}>`;
// };
