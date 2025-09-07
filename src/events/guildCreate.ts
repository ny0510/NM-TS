import {EmbedBuilder, Events, type Guild} from 'discord.js';

import type {NMClient} from '@/client/Client';
import {checkMissingPermissions, generateInviteLink} from '@/utils/discord/permissions/basicPermissions';

export default {
  name: Events.GuildCreate,
  execute: async (guild: Guild) => {
    const client = guild.client as NMClient;
    client.logger.guildJoined(guild, client);

    try {
      // 봇의 권한 확인
      const botMember = await guild.members.fetch(client.user!.id);
      const missingPermissions = checkMissingPermissions(botMember.permissions);

      if (missingPermissions.length > 0) {
        client.logger.warn(`Bot is missing permissions in guild ${guild.name}: ${missingPermissions.join(', ')}`);

        // 서버 소유자에게 알림
        try {
          const owner = await guild.fetchOwner();
          const inviteLink = generateInviteLink(client.user!.id);

          await owner.send({
            embeds: [
              new EmbedBuilder()
                .setTitle(`⚠️ ${client.user?.displayName}의 권한이 부족해요`)
                .setDescription(`**${guild.name}** 서버에서 ${client.user?.displayName}이 정상 작동하려면 추가 권한이 필요해요.`)
                .addFields(
                  {
                    name: '부족한 권한',
                    value: missingPermissions.join(', '),
                    inline: false,
                  },
                  {
                    name: '해결 방법',
                    value: `서버 설정에서 ${client.user?.displayName}에게 권한을 부여하거나, 아래 링크로 다시 초대해 주세요.\n\n[올바른 권한으로 다시 초대하기](${inviteLink})`,
                    inline: false,
                  },
                )
                .setColor(client.config.EMBED_COLOR_ERROR)
                .setFooter({text: '이 알림은 봇이 정상 작동하기 위해 전송되었습니다.'}),
            ],
          });
        } catch {
          // DM 실패시 무시
        }
      }
    } catch (error) {
      client.logger.error(`Failed to check permissions: ${error}`);
    }
  },
};
