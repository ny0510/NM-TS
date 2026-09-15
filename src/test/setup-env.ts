const testEnvDefaults: Record<string, string> = {
  NODE_ENV: 'test',
  DISCORD_TOKEN: 'test-discord-token',
  DISCORD_CLIENT_ID: '123456789012345678',
  DISCORD_GUILD_ID: '123456789012345678',
  EMBED_COLOR_NORMAL: '#5865f2',
  EMBED_COLOR_ERROR: '#ed4245',
  LOG_PREFIX: 'NM',
};

for (const [key, value] of Object.entries(testEnvDefaults)) {
  process.env[key] ??= value;
}
