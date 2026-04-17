'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type ViewMode } from '@/lib/view-mode'

type ViewModeQueryTabsProps = {
  value: ViewMode
  compact?: boolean
}

export function ViewModeQueryTabs({ value, compact = false }: ViewModeQueryTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleChange = (nextValue: string) => {
    const nextMode = (nextValue as ViewMode) || 'all'
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', nextMode)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={value} onValueChange={handleChange} className="w-auto">
      <TabsList className="bg-card border border-border">
        <TabsTrigger value="all" className={compact ? 'text-xs px-2.5' : 'text-xs sm:text-sm px-3 sm:px-4'}>
          All
        </TabsTrigger>
        <TabsTrigger value="study" className={compact ? 'text-xs px-2.5' : 'text-xs sm:text-sm px-3 sm:px-4'}>
          Study
        </TabsTrigger>
        <TabsTrigger value="health" className={compact ? 'text-xs px-2.5' : 'text-xs sm:text-sm px-3 sm:px-4'}>
          Health
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
