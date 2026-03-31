import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { X } from 'lucide-react'
import { ScrollArea } from '~/components/ui/scroll-area'

export function InspectPanel({
  title,
  subtitle,
  color,
  children,
}: {
  title: string
  subtitle?: string
  color?: string | null
  children: ReactNode
}) {
  return (
    <div className="w-80 min-w-80 border-l border-border h-full bg-card flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <Link to=".." className="text-muted-foreground hover:text-foreground transition-colors">
          <X size={14} />
        </Link>
        {color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold truncate">{title}</h2>
          {subtitle && <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>}
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-1">{children}</div>
      </ScrollArea>
    </div>
  )
}

export function InspectSection({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <div className="py-2">
      <div className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
        {count != null && <span className="ml-1">({count})</span>}
      </div>
      {children}
    </div>
  )
}

export function ThingLink({
  to,
  label,
  sublabel,
  color,
  icon,
}: {
  to: string
  label: string
  sublabel?: string
  color?: string | null
  icon?: ReactNode
}) {
  return (
    <Link to={to} className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent rounded-md text-sm transition-colors">
      {icon}
      {color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />}
      <span className="truncate">{label}</span>
      {sublabel && <span className="text-muted-foreground text-xs ml-auto shrink-0">{sublabel}</span>}
    </Link>
  )
}

export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-1 text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="text-xs">{children}</div>
    </div>
  )
}
