import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'bs-press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--primary)] text-white hover:bg-[color-mix(in_srgb,var(--primary)_88%,black)] focus-visible:ring-[color-mix(in_srgb,var(--primary)_35%,white)] ring-offset-[var(--surface)]',
        outline:
          'border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)] text-[var(--foreground)] focus-visible:ring-[color-mix(in_srgb,var(--primary)_30%,white)] ring-offset-[var(--surface)]',
        ghost:
          'text-[var(--foreground)] hover:bg-[var(--surface-2)] focus-visible:ring-[color-mix(in_srgb,var(--primary)_25%,white)] ring-offset-[var(--surface)]',
        destructive:
          'bg-[var(--danger)] text-white hover:bg-[color-mix(in_srgb,var(--danger)_88%,black)] focus-visible:ring-[color-mix(in_srgb,var(--danger)_30%,white)] ring-offset-[var(--surface)]',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
)
Button.displayName = 'Button'

export { Button, buttonVariants }
