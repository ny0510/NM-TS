import fs from 'node:fs';

import type {NMClient} from '@/client';
import {deployCommands} from '@/deploy';
import {generateInviteLink} from '@/utils/invite';
import {clearTerm, setupTerm} from '@/utils/term';

const keycap = (key: string): string => `\x1b[7m ${key} \x1b[27m`;
const SHORTCUT_BAR = `${keycap('d')} 명령어 동기화   ${keycap('r')} 재시작   ${keycap('i')} 초대 링크   ${keycap('q')} 종료`;

export const setupDevShortcuts = (client: NMClient): void => {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return;

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', async key => {
    const input = key.toString();

    if (input === 'd') {
      try {
        await deployCommands({scope: 'guild', preserveRemoteCommands: true});
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        client.logger.error(error);
      }
      return;
    }

    if (input === 'r') {
      const entry = process.argv[1];
      if (entry) {
        client.logger.info('Restarting...');
        fs.writeFileSync(entry, fs.readFileSync(entry));
      }
      return;
    }

    if (input === 'i') {
      if (client.isReady()) {
        client.logger.info(`Invite: ${generateInviteLink(client)}`);
      } else {
        client.logger.warn('Client is not ready yet.');
      }
      return;
    }

    if (input === '\x0c') {
      clearTerm();
      return;
    }

    if (input === 'q' || input === '\x03') {
      process.stdin.setRawMode(false);
      process.kill(process.pid, 'SIGINT');
    }
  });

  setupTerm(SHORTCUT_BAR);
};
