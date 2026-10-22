import {z} from 'zod';
import {type RadioApiReader, readRadioText, waitForRadioRequest} from './radioRequest';
import {findRadioStationById} from './radioStations';
import {type RadioStreamDefinition, radioStreams, radioStreamUrlSchema} from './radioStreams';

const kbsSchema = z.object({channel_item: z.array(z.object({service_url: radioStreamUrlSchema})).min(1)});
const boraSchema = z.object({BoraURL: z.string()});

export class RadioStreamError extends Error {
  override readonly name = 'RadioStreamError';
}

interface RadioResolverDependencies {
  readonly readApi?: RadioApiReader;
  readonly now?: () => Date;
  readonly streams?: Readonly<Record<string, RadioStreamDefinition>>;
}

function busanMbcUrl(stream: Extract<RadioStreamDefinition, {type: 'busan-mbc'}>, now: Date): string {
  const date = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const digits = `${String(date.getUTCFullYear()).slice(-2)}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;
  const code = Array.from(digits, digit => stream.dateCodes[Number(digit)]).join('');
  return stream.url.replaceAll('{date}', code);
}

export function createRadioStreamResolver({readApi = readRadioText, now = () => new Date(), streams = radioStreams}: RadioResolverDependencies = {}) {
  return async (stationId: string, signal?: AbortSignal): Promise<string | undefined> => {
    signal?.throwIfAborted();
    const station = findRadioStationById(stationId);
    if (!station) return undefined;
    const stream = streams[station.id];
    if (!stream) throw new RadioStreamError(`Missing radio stream configuration: ${station.id}`);
    const read = async () => {
      const text = await waitForRadioRequest(readApi(stream.url, signal), signal);
      signal?.throwIfAborted();
      return text.trim();
    };
    switch (stream.type) {
      case 'direct':
        return stream.url;
      case 'busan-mbc':
        return busanMbcUrl(stream, now());
      case 'text':
        return radioStreamUrlSchema.parse(await read());
      case 'kbs':
        return kbsSchema.parse(JSON.parse(await read())).channel_item[0]?.service_url;
      case 'mbc-bora': {
        const json = (await read()).replace(/^__boraplay\(/, '').replace(/\);?$/, '');
        return radioStreamUrlSchema.parse(boraSchema.parse(JSON.parse(json)).BoraURL.trim());
      }
      case 'afn': {
        const text = await read();
        const host = [...text.matchAll(/<ip>([^<]+)<\/ip>/g)].at(-1)?.[1];
        if (!host || !/^[a-z0-9.-]+$/i.test(host)) throw new RadioStreamError('AFN API returned no valid stream host');
        return radioStreamUrlSchema.parse(new URL(stream.path, `https://${host}`).href);
      }
      default: {
        const unreachable: never = stream;
        return unreachable;
      }
    }
  };
}

export const resolveRadioStream = createRadioStreamResolver();
