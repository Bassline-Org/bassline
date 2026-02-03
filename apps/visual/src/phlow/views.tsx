import { atom, useAtom } from 'jotai'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Textarea } from '../components/ui/textarea'
import { BoundForm, useBoundState } from '@/magritte'
import { ColumnedList, Descriptor, Explicit, Forward, List, PhlowViewType, TextEditor, IViewable } from './phlow'

export function TextView({ item }: { item: TextEditor }) {
  const textAtom = useMemo(() => atom(item.text()), [item])
  const [text, setText] = useAtom(textAtom)
  return (
    <Textarea
      className="min-h-[200px] w-full"
      value={text}
      onChange={e => {
        const value = e.target.value
        setText(value)
        item?.onChange?.(value)
      }}
      onBlur={e => item?.onBlur?.(e.target.value)}
    />
  )
}
export function ListView<T>({ item }: { item: List<T> }) {
  const items = useMemo(() => item.items(), [item])
  return (
    <ul className="space-y-1 overflow-auto">
      {items.map((e, i) => (
        <li key={i} className="px-2 py-1 rounded hover:bg-muted/50 text-sm truncate">
          {item.text(e)}
        </li>
      ))}
    </ul>
  )
}

export function ColumnedListView<T>({ item }: { item: ColumnedList<T> }) {
  const items = useMemo(() => item.items(), [item.items])
  const columns = useMemo(() => Object.entries(item.columns), [item.columns])
  const columnNames = columns.map(([k, _v]) => k)
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b border-border/50">
          {columnNames.map(name => (
            <TableHead key={name} className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              {name}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((row, i) => (
          <TableRow key={i}>
            {columns.map(([colName, { text, icon }]) => (
              <TableCell key={colName}>{icon ? icon(row) : text ? text(row) : null}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function ForwardView({ item }: { item: Forward }) {
  const targetViews = useMemo(() => item.target().phlowViews, [item])
  const viewIndex = item.viewIndex ?? 0
  const targetView = targetViews[viewIndex]

  if (!targetView || targetView.phlow === 'empty') {
    return <div className="text-muted-foreground text-sm">No view available</div>
  }

  return <PhlowView item={targetView} />
}

export function ExplicitView({ item }: { item: Explicit }) {
  return <>{item.component()}</>
}

export function DescriptorView<T extends object>({ item }: { item: Descriptor<T> }) {
  const schema = useMemo(() => item.description(), [item])
  const initialModel = useMemo(() => item.model(), [item])

  const { bound, model, validation, hasErrors } = useBoundState<T>(schema, initialModel)

  // Notify on changes (consequential - doesn't block)
  useEffect(() => {
    item.onUpdate?.(model)
  }, [model, item])

  return <BoundForm bound={bound} validation={validation} hasErrors={hasErrors} />
}

export function PhlowView<T>({ item }: { item: PhlowViewType<T> }) {
  const type = item.phlow

  if (type === 'empty') return null

  // Forward delegates to target's view - renders without extra card wrapper
  if (type === 'forward') {
    return <ForwardView item={item} />
  }

  // Explicit views render their own content directly
  if (type === 'explicit') {
    return (
      <Card className="h-full w-full flex flex-col overflow-hidden">
        <CardHeader className="shrink-0">
          <CardTitle>{item.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          <ExplicitView item={item} />
        </CardContent>
      </Card>
    )
  }

  let body = null
  const { title } = item

  if (type === 'textEditor') {
    body = <TextView item={item} />
  }
  if (type === 'list') {
    body = <ListView item={item} />
  }
  if (type === 'columnedList') {
    body = <ColumnedListView item={item} />
  }
  if (type === 'descriptor') {
    body = <DescriptorView item={item as Descriptor<object>} />
  }

  return (
    <Card className="h-full w-full flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">{body}</CardContent>
    </Card>
  )
}

export function Inspector({ target }: { target: IViewable }) {
  const views = useMemo(() => {
    const v = target.phlowViews.filter(view => view.phlow !== 'empty')
    return v.sort((a, b) => {
      const aPriority = 'priority' in a ? a.priority : 100
      const bPriority = 'priority' in b ? b.priority : 100
      return aPriority - bPriority
    })
  }, [target])

  const [selectedIndex, setSelectedIndex] = useState(0)
  const selectedView = views[selectedIndex]

  if (views.length === 0) {
    return <div className="text-muted-foreground text-sm">No views available</div>
  }

  return (
    <div className="flex gap-4 h-full w-full">
      <Card className="flex-shrink-0 p-2">
        <div className="flex flex-col gap-1">
          {views.map((view, i) => (
            <Button
              key={i}
              variant={i === selectedIndex ? 'secondary' : 'ghost'}
              className="justify-start"
              onClick={() => setSelectedIndex(i)}
            >
              {'title' in view ? view.title : 'View'}
            </Button>
          ))}
        </div>
      </Card>
      <div className="flex-1 min-w-0">
        <PhlowView item={selectedView} />
      </div>
    </div>
  )
}
