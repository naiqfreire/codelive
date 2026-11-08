import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Spinner } from './Spinner'

type ButtonVariant = 'primary' | 'secondary'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  isLoading?: boolean
  children: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-foreground hover:brightness-110 disabled:bg-accent/50',
  secondary:
    'border border-border bg-surface text-foreground hover:bg-secondary disabled:opacity-50',
}

export function Button({
  variant = 'primary',
  isLoading = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      aria-busy={isLoading || undefined}
      disabled={disabled || isLoading}
      className={[
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 font-medium transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed',
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      {isLoading ? <Spinner /> : null}
      {children}
    </button>
  )
}
