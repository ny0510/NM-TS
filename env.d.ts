declare namespace NodeJS {
  interface ProcessEnv {
    DISCORD_TOKEN: string;
    DISCORD_CLIENT_ID: string;
    DISCORD_GUILD_ID: string;

    LAVALINK_IDENTIFIER: string;
    LAVALINK_HOST: string;
    LAVALINK_PORT: string;
    LAVALINK_PASSWORD: string;
    LAVALINK_SECURE: string;

    EMBED_COLOR_NORMAL: string;
    EMBED_COLOR_ERROR: string;

    LOG_PREFIX: string;
    DEFAULT_VOLUME: string;
  }
}
