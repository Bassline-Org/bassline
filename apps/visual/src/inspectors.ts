/**
 * Custom inspector components using shadcn/ui
 * Pass this to InspectorProvider to use shadcn styling
 */

import type { InspectorComponents } from '@bassline/ui'
import { Button } from './components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './components/ui/table'
import { Textarea } from './components/ui/textarea'
import { Form } from './forms'

export const Inspectors: Partial<InspectorComponents> = {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Textarea,
  // Form component has different generic signature, cast for compatibility
  Form: Form as any,
}
