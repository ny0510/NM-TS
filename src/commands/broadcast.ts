import {EmbedBuilder, MessageFlags, SlashCommandBuilder, Team, User, codeBlock} from 'discord.js';
import type {ChatInputCommandInteraction} from 'discord.js';

import type {Command} from '@/client/types';
import {getClient} from '@/utils/discord/client';

export default {
  data: new SlashCommandBuilder()
    .setName('broadcast')
    .setDescription('현재 재생중인 모든 서버에 공지사항을 보내요.')
    .addStringOption(option => option.setName('message').setDescription('보낼 공지사항 내용').setRequired(true))
    .addBooleanOption(option => option.setName('preview').setDescription('전송 전 임베드 미리보기').setRequired(false)),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = getClient(interaction);

    try {
      if (client.application && typeof client.application.fetch === 'function') {
        await client.application.fetch();
      }
    } catch {}

    const owner = client.application?.owner;
    let isOwner = false;

    if (owner instanceof User) {
      isOwner = owner.id === interaction.user.id;
    } else if (owner instanceof Team) {
      isOwner = owner.members.some(m => m.user.id === interaction.user.id);
    }

    if (!isOwner) return;

    const message = interaction.options.getString('message', true);
    const preview = interaction.options.getBoolean('preview') || false;

    const queues = Array.from(client.queues.values()).filter(q => q.playing);
    if (queues.length === 0) {
      await interaction.reply({content: '현재 재생중인 서버가 없습니다.', flags: [MessageFlags.Ephemeral]});
      return;
    }

    if (preview) {
      const embed = new EmbedBuilder().setTitle('📢 공지사항 (미리보기)').setDescription(message).setColor(client.config.EMBED_COLOR_NORMAL);
      await interaction.reply({embeds: [embed], flags: [MessageFlags.Ephemeral]});
      return;
    }

    await interaction.deferReply({flags: MessageFlags.Ephemeral});

    let success = 0;
    let fail = 0;
    const failedList: string[] = [];

    const tasks = queues.map(queue =>
      (async () => {
        const channel = client.channels.cache.get(queue.textChannelId || '');
        if (!channel || !channel.isSendable()) {
          throw new Error('Channel not sendable');
        }
        const embed = new EmbedBuilder().setTitle('📢 공지사항').setDescription(message).setColor(client.config.EMBED_COLOR_NORMAL);
        await channel.send({embeds: [embed]});
        return queue.guildId;
      })(),
    );

    const settled = await Promise.allSettled(tasks);
    settled.forEach((r, i) => {
      const guildId = queues[i]?.guildId ?? 'unknown';
      if (r.status === 'fulfilled') {
        success++;
      } else {
        fail++;
        failedList.push(`${client.guilds.cache.get(guildId)?.name || '알 수 없음'} (${guildId}) - ${r.reason.split(': ')[1]}`);
      }
    });

    const resultEmbed = new EmbedBuilder()
      .setTitle('📢 공지사항 전송 결과')
      .setColor(fail > 0 ? client.config.EMBED_COLOR_ERROR : client.config.EMBED_COLOR_NORMAL)
      .setDescription(`총 **${queues.length}개** 서버 중 **${success}개** 서버에 성공적으로 전송되었습니다. ${fail ? `(${fail}개 실패)` : ''}`);

    if (failedList.length > 0) {
      const shown = failedList.slice(0, 50);
      const failedText = codeBlock(`${shown.join('\n')}${failedList.length > 50 ? `\n...및 ${failedList.length - 50}개 더` : ''}`);
      resultEmbed.addFields({name: '실패한 서버 목록', value: failedText});
    }

    await interaction.editReply({embeds: [resultEmbed]});
  },
} as Command;
