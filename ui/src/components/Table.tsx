import type { HTMLAttributes, TableHTMLAttributes, ReactNode } from 'react'
import styles from '~/css/components/Table.module.css'

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  children: ReactNode
}

export function Table({ children, className, ...props }: TableProps) {
  return (
    <table className={`${styles.table} ${className ?? ''}`} {...props}>
      {children}
    </table>
  )
}

export interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode
}

export function TableHeader({ children, className, ...props }: TableHeaderProps) {
  return (
    <thead className={`${styles.header} ${className ?? ''}`} {...props}>
      {children}
    </thead>
  )
}

export interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode
}

export function TableBody({ children, className, ...props }: TableBodyProps) {
  return (
    <tbody className={`${styles.body} ${className ?? ''}`} {...props}>
      {children}
    </tbody>
  )
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  children: ReactNode
}

export function TableRow({ children, className, ...props }: TableRowProps) {
  return (
    <tr className={`${styles.row} ${className ?? ''}`} {...props}>
      {children}
    </tr>
  )
}

export interface TableHeadProps extends HTMLAttributes<HTMLTableCellElement> {
  children: ReactNode
}

export function TableHead({ children, className, ...props }: TableHeadProps) {
  return (
    <th className={`${styles.head} ${className ?? ''}`} {...props}>
      {children}
    </th>
  )
}

export interface TableCellProps extends HTMLAttributes<HTMLTableCellElement> {
  children: ReactNode
}

export function TableCell({ children, className, ...props }: TableCellProps) {
  return (
    <td className={`${styles.cell} ${className ?? ''}`} {...props}>
      {children}
    </td>
  )
}
