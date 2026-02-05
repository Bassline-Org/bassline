import type { TextareaHTMLAttributes } from 'react'
import { KEYBOARD_NOCAPTURE } from '../core/constants'
import styles from '~/css/components/Textarea.module.css'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ className, ...props }: TextareaProps) {
  return <textarea className={`${styles.textarea} ${KEYBOARD_NOCAPTURE} ${className ?? ''}`} {...props} />
}
