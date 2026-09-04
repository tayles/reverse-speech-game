import * as SliderPrimitive from '@radix-ui/react-slider'
import * as React from 'react'

import { cn } from '@/lib/utils'

const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex w-full touch-none items-center py-4 select-none', className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-5 w-full grow overflow-hidden rounded-full bg-white/12 ring-1 ring-white/15">
      <SliderPrimitive.Range className="absolute h-full bg-bubble" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className="block size-14 rounded-full bg-white shadow-[0_4px_0_0_rgba(0,0,0,0.35)] ring-4 ring-bubble transition focus-visible:ring-8 focus-visible:ring-bubble/70 focus-visible:outline-none active:scale-95 disabled:pointer-events-none"
      aria-label="Number of players"
    />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
