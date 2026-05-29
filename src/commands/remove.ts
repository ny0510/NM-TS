import {type AutocompleteInteraction, ChatInputCommandInteraction, DiscordAPIError, EmbedBuilder, type HexColorString, MessageFlags, SlashCommandBuilder, codeBlock} from 'discord.js';

import type {Command} from '@/types/client';
import {truncateWithEllipsis} from '@/utils';
import {getClient} from '@/utils/discord/client';
import {createErrorEmbed} from '@/utils/discord/embeds';
import {safeReply} from '@/utils/discord/interactions';
import {ensurePlayerReady} from '@/utils/music';

const MAX_AUTOCOMPLETE_RESULTS = 25;

export default {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('대기열에서 음악을 제거해요.')
    .addStringOption(option => option.setName('track').setDescription('🗑️ 제거할 음악을 선택해 주세요.').setRequired(true).setAutocomplete(true)),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await ensurePlayerReady(interaction, {requirePlaying: true}))) return;

    const client = getClient(interaction);
    const queue = client.queues.get(interaction.guildId!);
    if (!queue) return;

    const trackValue = interaction.options.getString('track', true);
    const userIndex = parseInt(trackValue, 10);
    const index = userIndex - 1;

    if (isNaN(userIndex) || userIndex < 1 || index >= queue.size()) {
      return await safeReply(interaction, {
        embeds: [
          createErrorEmbed(
            client,
            '유효하지 않은 음악 번호예요.',
            `대기열 범위 내의 번호(1 ~ ${queue.size()})를 입력하거나 자동완성 목록에서 선택해 주세요.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const tracks = queue.getSlice(index, index + 1);
    const track = tracks[0];

    if (!track) {
      return await safeReply(interaction, {
        embeds: [createErrorEmbed(client, `${userIndex}번째 음악이 없어요.`)],
        flags: MessageFlags.Ephemeral,
      });
    }

    queue.remove(index);
    return await safeReply(interaction, {
      embeds: [
        new EmbedBuilder()
          .setTitle(`${userIndex}번째 음악을 대기열에서 제거했어요.`)
          .setDescription(codeBlock('diff', `- ${track.info.title}`))
          .setColor(client.config.EMBED_COLOR_NORMAL as HexColorString),
      ],
    });
  },
  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const client = getClient(interaction);

    const respondSafely = async (choices: {name: string; value: string}[]) => {
      try {
        await interaction.respond(choices);
      } catch (error) {
        if (error instanceof DiscordAPIError && error.code === 10062) {
          client.logger.debug('Autocomplete interaction expired before response could be sent.');
          return;
        }
        client.logger.error(new Error(`Failed to respond to autocomplete interaction: ${error instanceof Error ? error.message : String(error)}`));
      }
    };

    const queue = client.queues.get(interaction.guildId!);
    if (!queue || queue.size() === 0) {
      await respondSafely([]);
      return;
    }

    const focused = interaction.options.getFocused();
    const allTracks = queue.getSlice(0, queue.size());

    const choices = allTracks
      .map((track, i) => {
        const label = `${i + 1}. ${track.info.title}`;
        return {
          name: truncateWithEllipsis(label, 100),
          value: String(i + 1),
          title: track.info.title,
          index: i,
        };
      })
      .filter(choice => {
        if (!focused) return choice.index < MAX_AUTOCOMPLETE_RESULTS;
        const query = focused.toLowerCase();
        return choice.title.toLowerCase().includes(query) || String(choice.index + 1) === query;
      })
      .slice(0, MAX_AUTOCOMPLETE_RESULTS)
      .map(({name, value}) => ({name, value}));

    await respondSafely(choices);
  },
} satisfies Command;
