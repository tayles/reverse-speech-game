import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-extrabold',
  {
    variants: {
      variant: {
        default: 'bg-white/12 text-white/85 ring-1 ring-white/15',
        good: 'bg-lime/25 text-lime ring-1 ring-lime/40',
        warn: 'bg-sun/25 text-sun ring-1 ring-sun/40',
        hot: 'bg-tang/25 text-tang ring-1 ring-tang/40',
        grape: 'bg-grape/30 text-white ring-1 ring-grape/50',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
