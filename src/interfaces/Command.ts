import {PermissionsBitField, SlashCommandBuilder, type SlashCommandOptionsOnlyBuilder} from 'discord.js';

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  permissions?: PermissionsBitField[] | bigint[];
  cooldown?: number;
  // voiceSafetyChecks?: boolean;
  execute(...args: any): Promise<void> | void;
}
