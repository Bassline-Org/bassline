import { ChevronRight, Home } from 'lucide-react'
import { Button } from '~/components/ui/button'

interface BreadcrumbItem {
  id: string
  name: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  onNavigate: (groupId: string) => void
}

export function Breadcrumbs({ items, onNavigate }: BreadcrumbsProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-muted/50 rounded-md select-none">
      {items.map((item, index) => (
        <div key={item.id} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 py-1"
            onClick={() => onNavigate(item.id)}
          >
            {index === 0 ? (
              <Home className="w-4 h-4 mr-1" />
            ) : null}
            <span className="text-sm">{item.name}</span>
          </Button>
        </div>
      ))}
    </div>
  )
}