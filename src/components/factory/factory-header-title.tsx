'use client'

import { usePathname } from 'next/navigation'

type FactoryHeaderTitleProps = {
  username?: string | null
}

const titleMap: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': {
    title: 'Dashboard',
    subtitle: 'Ready to lock in?',
  },
  '/history': {
    title: 'History',
    subtitle: 'Track your daily grind and session logs.',
  },
}

export function FactoryHeaderTitle({ username }: FactoryHeaderTitleProps) {
  const pathname = usePathname()
  const content = titleMap[pathname]

  if (!content) return null

  return (
    <div className="hidden lg:flex flex-col min-w-0">
      <div className="text-sm font-semibold text-zinc-100 truncate">{content.title}</div>
      <div className="text-xs text-zinc-500 truncate">
        {pathname === '/dashboard' && username ? `Welcome back, ${username}. ` : ''}
        {content.subtitle}
      </div>
    </div>
  )
}
