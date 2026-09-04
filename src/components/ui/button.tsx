import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * A raised, pressable face. Hovering part-presses the button and clicking
 * presses it home; the travel and the shadow always add up to 6px, so the
 * bottom edge stays put and only the top moves — which is what makes it read
 * as a physical key rather than a card that slides about.
 *
 * The colour comes from --btn-shade so the geometry is written once. Tailwind
 * only generates arbitrary values it can see literally, hence the var().
 */
const RAISED =
  'shadow-[0_6px_0_0_var(--btn-shade)] hover:translate-y-[2px] hover:shadow-[0_4px_0_0_var(--btn-shade)] active:translate-y-[4px] active:shadow-[0_2px_0_0_var(--btn-shade)]'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-extrabold tracking-tight whitespace-nowrap transition-[translate,scale,background-color,box-shadow,filter] duration-100 focus-visible:ring-4 focus-visible:ring-white/40 focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: `${RAISED} bg-grape text-white [--btn-shade:oklch(0.42_0.18_300)] hover:brightness-110`,
        fun: `${RAISED} bg-bubble text-ink [--btn-shade:oklch(0.48_0.16_350)] hover:brightness-110`,
        go: `${RAISED} bg-lime text-ink [--btn-shade:oklch(0.62_0.17_135)] hover:brightness-110`,
        sun: `${RAISED} bg-sun text-ink [--btn-shade:oklch(0.62_0.14_85)] hover:brightness-110`,
        sky: `${RAISED} bg-sky text-ink [--btn-shade:oklch(0.55_0.13_225)] hover:brightness-110`,
        danger: `${RAISED} bg-tang text-ink [--btn-shade:oklch(0.52_0.16_40)] hover:brightness-110`,
        soft: 'bg-white/10 text-white ring-1 ring-white/15 backdrop-blur hover:bg-white/16',
        outline: 'bg-transparent text-white ring-2 ring-white/25 hover:bg-white/10',
        ghost: 'bg-transparent text-white/80 hover:bg-white/10 hover:text-white',
      },
      size: {
        sm: 'h-10 rounded-2xl px-4 text-sm [&_svg]:size-4',
        default: 'h-14 rounded-[1.25rem] px-6 text-lg [&_svg]:size-5',
        lg: 'h-[4.5rem] rounded-blob px-8 text-2xl [&_svg]:size-7',
        xl: 'h-24 rounded-blob px-10 text-3xl [&_svg]:size-9',
        icon: 'size-14 rounded-[1.25rem] [&_svg]:size-6',
        iconSm: 'size-10 rounded-2xl [&_svg]:size-5',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
