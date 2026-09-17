export const TIMELINE_GRAINS = ['month', 'year'] as const

export type TimelineGrain = (typeof TIMELINE_GRAINS)[number]

export const DEFAULT_TIMELINE_GRAIN: TimelineGrain = 'month'

export function isTimelineGrain(value: unknown): value is TimelineGrain {
  return TIMELINE_GRAINS.includes(value as TimelineGrain)
}
