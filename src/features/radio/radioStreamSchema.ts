import {z} from 'zod';

export const radioStreamUrlSchema = z.url().refine(value => ['http:', 'https:'].includes(new URL(value).protocol) && new URL(value).hostname !== 'radio.bsod.kr');

const definitionSchema = z.discriminatedUnion('type', [
  z.object({type: z.literal('direct'), url: radioStreamUrlSchema}),
  z.object({type: z.literal('text'), url: radioStreamUrlSchema}),
  z.object({type: z.literal('kbs'), url: radioStreamUrlSchema}),
  z.object({type: z.literal('mbc-bora'), url: radioStreamUrlSchema}),
  z.object({type: z.literal('busan-mbc'), url: radioStreamUrlSchema, dateCodes: z.string().length(10)}),
  z.object({type: z.literal('afn'), url: radioStreamUrlSchema, path: z.string().startsWith('/')}),
]);

export type RadioStreamDefinition = z.infer<typeof definitionSchema>;
export const parseRadioStreams = (data: unknown): Readonly<Record<string, RadioStreamDefinition>> => z.record(z.string(), definitionSchema).parse(data);
