import {type AutocompleteInteraction, ChatInputCommandInteraction, DiscordAPIError, MessageFlags, PermissionsBitField, SlashCommandBuilder} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Command} from '@/client/types';
import {getGoogleSuggestions} from '@/utils/autocomplete/googleSuggest';
import {ensureSameVoiceChannel, ensureVoiceChannel} from '@/utils/music';
import {addTrackToQueue} from '@/utils/music/playerUtils';

export default {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('음악을 재생해요.')
    .addStringOption(option => option.setName('query').setDescription('재생할 음악의 제목이나 URL을 입력해 주세요.').setRequired(true).setAutocomplete(true))
    .addBooleanOption(option => option.setName('add_first').setDescription('대기열의 맨 앞에 음악을 추가해요.').setRequired(false))
    .addIntegerOption(option => option.setName('index').setDescription('대기열의 특정 위치에 음악을 추가해요.').setRequired(false))
    .addBooleanOption(option => option.setName('ignore_playlist').setDescription('재생목록을 무시하고 해당 음악만 추가해요.').setRequired(false))
    .addBooleanOption(option => option.setName('exclude_cover').setDescription('커버 곡을 제외하고 검색해요.').setRequired(false))
    .addBooleanOption(option => option.setName('exclude_shorts').setDescription('쇼츠 영상을 제외하고 검색해요.').setRequired(false)),
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = interaction.client as NMClient;

    if (!(await ensureVoiceChannel(interaction))) return; // 음성 채널에 들어가 있는지 확인
    if (!(await ensureSameVoiceChannel(interaction))) return; // 같은 음성 채널에 있는지 확인

    await interaction.deferReply();

    const query = interaction.options.getString('query', true);
    const addFirst = interaction.options.getBoolean('add_first') ?? false;
    const index = interaction.options.getInteger('index');
    const ignorePlaylist = interaction.options.getBoolean('ignore_playlist') ?? false;
    const excludeCover = interaction.options.getBoolean('exclude_cover') ?? false;
    const excludeShorts = interaction.options.getBoolean('exclude_shorts') ?? false;

    await addTrackToQueue(client, interaction, {
      query,
      addFirst,
      index,
      ignorePlaylist,
      excludeCover,
      excludeShorts,
      source: 'play',
    });
  },
  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);

    const client = interaction.client as NMClient;

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

    if (focusedOption.name === 'query') {
      const query = focusedOption.value;

      // 빈 쿼리이거나 URL인 경우 자동완성 제안하지 않음
      if (!query || query.trim().length === 0 || /https?:\/\//i.test(query)) {
        await respondSafely([]);
        return;
      }

      try {
        const suggestions = await getGoogleSuggestions(query);
        const choices = suggestions.map(suggestion => ({
          name: suggestion.length > 100 ? suggestion.substring(0, 97) + '...' : suggestion,
          value: suggestion.length > 100 ? suggestion.substring(0, 100) : suggestion,
        }));

        await respondSafely(choices);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          client.logger.debug('Autocomplete suggestions request timed out; responding with empty list.');
        } else {
          client.logger.error(new Error(`Autocomplete error: ${error instanceof Error ? error.message : String(error)}`));
        }
        await respondSafely([]);
      }
    } else {
      await respondSafely([]);
    }
  },
} as Command;
