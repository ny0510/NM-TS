import type {Client} from 'discord.js';

import {generateInviteLink as generateInviteLinkForClientId} from '@/shared/discord/permissions/basicPermissions';

export const generateInviteLink = (client: Client<true>): string => generateInviteLinkForClientId(client.user.id);
