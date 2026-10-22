import streamData from '../../../data/radio/streams.json';
import {parseRadioStreams} from './radioStreamSchema';

export {parseRadioStreams, type RadioStreamDefinition, radioStreamUrlSchema} from './radioStreamSchema';
export const radioStreams = parseRadioStreams(streamData);
