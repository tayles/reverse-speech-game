import * as React from 'react'

import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-14 w-full rounded-[1.25rem] bg-white/10 px-5 text-lg font-bold text-white ring-2 ring-white/15 transition placeholder:font-medium placeholder:text-white/35 focus-visible:ring-4 focus-visible:ring-bubble/70 focus-visible:outline-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export { Input }
