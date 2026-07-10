import type {ChartRankingRow} from '@/features/chart/data';

export interface MutablePage {
  value: number;
}

export interface MutableRanking {
  value: ChartRankingRow[];
}

export interface MutableTotalPages {
  value: number;
}
