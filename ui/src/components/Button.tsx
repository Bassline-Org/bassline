import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'ghost' | 'outline' | 'destructive' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  children: ReactNode
}

export function Button({ children, variant = 'default', size = 'default', className, ...props }: ButtonProps) {
  const variantClass = styles[variant] ?? styles.default
  const sizeClass = styles[`size-${size}`] ?? styles['size-default']

  return (
    <button className={`${styles.button} ${variantClass} ${sizeClass} ${className ?? ''}`} {...props}>
      {children}
    </button>
  )
}
