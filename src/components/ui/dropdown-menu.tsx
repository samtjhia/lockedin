"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type DropdownContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const DropdownMenuContext = React.createContext<DropdownContextValue | undefined>(undefined)

function useDropdownMenu() {
  const ctx = React.useContext(DropdownMenuContext)
  if (!ctx) {
    throw new Error("DropdownMenu components must be used within <DropdownMenu>")
  }
  return ctx
}

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-flex">{children}</div>
    </DropdownMenuContext.Provider>
  )
}

type TriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean
}

export const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, TriggerProps>(
  ({ asChild, children, className, ...props }, ref) => {
    const { open, setOpen } = useDropdownMenu()

    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      props.onClick?.(event)
      if (!event.defaultPrevented) {
        setOpen(!open)
      }
    }

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        ref,
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
          ;(children as any).props?.onClick?.(event)
          handleClick(event)
        },
      })
    }

    return (
      <button
        ref={ref}
        type="button"
        className={className}
        {...props}
        onClick={handleClick}
      >
        {children}
      </button>
    )
  }
)
DropdownMenuTrigger.displayName = "DropdownMenuTrigger"

type ContentProps = React.HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "end"
}

export const DropdownMenuContent = React.forwardRef<HTMLDivElement, ContentProps>(
  ({ className, align = "start", style, ...props }, ref) => {
    const { open, setOpen } = useDropdownMenu()
    const contentRef = React.useRef<HTMLDivElement | null>(null)
    const [mounted, setMounted] = React.useState(false)
    const [visible, setVisible] = React.useState(false)

    React.useImperativeHandle(ref, () => contentRef.current as HTMLDivElement)

    // Handle mount/unmount with animation
    React.useEffect(() => {
      if (open) {
        setMounted(true)
        // Request animation frame to ensure the element is in the DOM before triggering the transition
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setVisible(true)
          })
        })
      } else {
        setVisible(false)
        const timer = setTimeout(() => setMounted(false), 150) // match transition duration
        return () => clearTimeout(timer)
      }
    }, [open])

    React.useEffect(() => {
      if (!open) return

      const handleClickOutside = (event: MouseEvent) => {
        if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
          setOpen(false)
        }
      }

      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [open, setOpen])

    if (!mounted) return null

    return (
      <div
        ref={contentRef}
        className={cn(
          "absolute z-50 mt-2 min-w-[10rem] rounded-md border bg-background text-foreground shadow-md",
          "transition-all duration-150 ease-out origin-top-right",
          align === "end" ? "right-0" : "left-0",
          visible
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 -translate-y-1",
          className
        )}
        style={style}
        {...props}
      />
    )
  }
)
DropdownMenuContent.displayName = "DropdownMenuContent"

export const DropdownMenuLabel = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("px-3 py-1.5 text-xs font-medium text-muted-foreground", className)}
    {...props}
  />
)

export const DropdownMenuSeparator = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("my-1 h-px bg-border", className)}
    {...props}
  />
)

export const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { setOpen } = useDropdownMenu()

  const handleClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
    props.onClick?.(event)
    if (!event.defaultPrevented) {
      setOpen(false)
    }
  }

  return (
    <div
      ref={ref}
      className={cn(
        "flex cursor-pointer select-none items-center px-3 py-2 text-sm outline-none hover:bg-muted",
        className
      )}
      {...props}
      onClick={handleClick}
    />
  )
})
DropdownMenuItem.displayName = "DropdownMenuItem"

