declare namespace NodeJS {
  interface ProcessEnv {
    DISCORD_TOKEN: string;
    DISCORD_CLIENT_ID: string;
    DISCORD_GUILD_ID: string;
    DISCORD_LOG_WEBHOOK_URL?: string;

    LAVALINK_IDENTIFIER: string;
    LAVALINK_HOST: string;
    LAVALINK_PORT: string;
    LAVALINK_PASSWORD: string;
    LAVALINK_SECURE: string;

    EMBED_COLOR_NORMAL: string;
    EMBED_COLOR_ERROR: string;

    LOG_PREFIX: string;
    DEFAULT_VOLUME?: string;
    NODE_ENV?: 'development' | 'production';

    PLAYER_STATE_PATH?: string;

    KOREANBOTS_TOKEN?: string;
    KOREANBOTS_CLIENT_ID?: string;
    KOREANBOTS_UPDATE_INTERVAL?: string;

    PROGRESS_CIRCLE_START?: string;
    PROGRESS_CIRCLE_MIDDLE?: string;
    PROGRESS_FILLED_START?: string;
    PROGRESS_FILLED_MIDDLE?: string;
    PROGRESS_UNFILLED_MIDDLE?: string;
    PROGRESS_UNFILLED_END?: string;
  }
}
