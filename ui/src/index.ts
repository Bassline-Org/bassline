// Core exports (no React dependency)
export * from './core'

// React integration (context, hooks, atoms, views, inspector)
export * from './react'

// Default components - export only the components, not the prop types (those come from ./react/context)
export { DefaultComponents } from './components/defaults'
export { Card, CardHeader, CardTitle, CardContent } from './components/Card'
export { Button } from './components/Button'
export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './components/Table'
export { Textarea } from './components/Textarea'
export { Form } from './components/Form'
