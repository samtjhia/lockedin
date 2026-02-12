"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = "Avatar"

const AvatarImage = React.forwardRef<
  HTMLImageElement,
  React.ImgHTMLAttributes<HTMLImageElement>
>(({ className, src, ...props }, ref) => {
    // Simple handling: if src is missing or error, we might hide this.
    // However, in standard Radix, it handles this.
    // Let's rely on standard img behavior + CSS.
    // If we want fallback to show, the image must hide on error.
    
    // We can use a small hook or state if we want strict fallback behavior,
    // but for now let's just render the image. 
    // If it breaks, the alt text shows.
    // To properly show Fallback, we need state.
    
    const [hasError, setHasError] = React.useState(false)

    if (hasError || !src) return null

    return (
        <img
            ref={ref}
            src={src}
            className={cn("aspect-square h-full w-full", className)}
            onError={() => setHasError(true)}
            {...props}
        />
    )
})
AvatarImage.displayName = "AvatarImage"

const AvatarFallback = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }
