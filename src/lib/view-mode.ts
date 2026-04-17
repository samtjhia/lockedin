export const VIEW_MODES = ['all', 'study', 'health'] as const

export type ViewMode = (typeof VIEW_MODES)[number]

export function normalizeViewMode(value: string | null | undefined): ViewMode {
  if (!value) return 'all'
  const normalized = value.toLowerCase()
  return VIEW_MODES.includes(normalized as ViewMode) ? (normalized as ViewMode) : 'all'
}
