import {type ChatInputCommandInteraction, PermissionsBitField, SlashCommandBuilder} from 'discord.js';
import {handleRadio} from '@/features/music/radio/radioHandler';
import type {Command} from '@/types/client';

export const command = {
  data: new SlashCommandBuilder().setName('radio').setDescription('지역별 라디오 채널을 골라 대기열에 추가해요.'),
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await handleRadio(interaction);
  },
} satisfies Command;
