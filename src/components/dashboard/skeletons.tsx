'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="border-zinc-800 bg-zinc-950/50">
        <CardHeader className="pb-2">
          <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-[180px] bg-zinc-900 rounded animate-pulse" />
        </CardContent>
      </Card>
      <Card className="border-zinc-800 bg-zinc-950/50">
        <CardHeader className="pb-2">
          <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-[180px] bg-zinc-900 rounded animate-pulse" />
        </CardContent>
      </Card>
    </div>
  )
}

export function HeatMapSkeleton() {
  return (
    <Card className="border-zinc-800 bg-zinc-950/50">
      <CardHeader>
        <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-[120px] bg-zinc-900 rounded animate-pulse" />
      </CardContent>
    </Card>
  )
}

export function TaskListSkeleton() {
  return (
    <Card className="border-zinc-800 bg-zinc-950/50 h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="h-5 w-16 bg-zinc-800 rounded animate-pulse" />
      </CardHeader>
      <CardContent className="flex-1 space-y-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-4 w-4 bg-zinc-800 rounded animate-pulse" />
            <div className="h-4 flex-1 bg-zinc-800 rounded animate-pulse" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function ShiftLogSkeleton() {
  return (
    <Card className="border-zinc-800 bg-zinc-950/50 h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="h-5 w-24 bg-zinc-800 rounded animate-pulse" />
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-2 p-2 bg-zinc-900/50 rounded">
            <div className="h-3 w-3 bg-zinc-800 rounded-full animate-pulse" />
            <div className="flex-1 space-y-1">
              <div className="h-3 w-3/4 bg-zinc-800 rounded animate-pulse" />
              <div className="h-2 w-1/2 bg-zinc-800 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function ToolbarSkeleton() {
  return (
    <Card className="border-zinc-800 bg-zinc-950/50">
      <CardContent className="p-2 flex items-center gap-2">
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 bg-zinc-800 rounded animate-pulse" />
          {[1, 2].map(i => (
            <div key={i} className="h-7 w-16 bg-zinc-800 rounded animate-pulse" />
          ))}
        </div>
        <div className="h-5 w-px bg-zinc-700" />
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 bg-zinc-800 rounded animate-pulse" />
          {[1, 2].map(i => (
            <div key={i} className="h-7 w-16 bg-zinc-800 rounded animate-pulse" />
          ))}
        </div>
        <div className="h-5 w-px bg-zinc-700" />
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-7 w-7 bg-zinc-800 rounded animate-pulse" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
