export interface RadioStation {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly band: 'fm' | 'other' | 'unknown';
  readonly frequencyKHz?: number;
  readonly locality?: string;
}

export interface RadioRegion {
  readonly key: string;
  readonly label: string;
  readonly stations: readonly RadioStation[];
}
