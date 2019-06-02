import { StatsModifyOptions } from '../interfaces'

export const statsEquals = (
  stats1: StatsModifyOptions,
  stats2: StatsModifyOptions,
) => {
  return stats1.mode === stats2.mode
}
