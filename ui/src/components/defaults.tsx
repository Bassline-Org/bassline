import type { InspectorComponents } from '../react/context'
import { Card, CardHeader, CardTitle, CardContent } from './Card'
import { Button } from './Button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './Table'
import { Textarea } from './Textarea'
import { Form } from './Form'

/**
 * Default UI components for the inspector.
 * These are minimal, unstyled components that work without any CSS framework.
 * Override them by passing custom components to InspectorProvider.
 */
export const DefaultComponents: InspectorComponents = {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Textarea,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Form,
}
