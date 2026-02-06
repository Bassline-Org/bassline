import {
  createContext,
  useContext,
  useMemo,
  type ComponentType,
  type PropsWithChildren,
  type ReactNode,
  type HTMLAttributes,
  type TextareaHTMLAttributes,
  type ButtonHTMLAttributes,
  type TableHTMLAttributes,
  type FormHTMLAttributes,
} from 'react'

// ============================================================================
// Component Prop Types
// ============================================================================

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode
}

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'ghost' | 'outline' | 'destructive' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  children: ReactNode
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  children: ReactNode
}

export interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode
}

export interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  children: ReactNode
}

export interface TableHeadProps extends HTMLAttributes<HTMLTableCellElement> {
  children: ReactNode
}

export interface TableCellProps extends HTMLAttributes<HTMLTableCellElement> {
  children: ReactNode
}

export interface FormProps<T = unknown> extends Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  /** The validation schema */
  schema: unknown
  /** Initial/current values */
  values?: T
  /** Called when form is submitted with valid data */
  onSubmit: (data: T) => void
  /** Submit button label */
  submitLabel?: string
}

// ============================================================================
// Component Registry Interface
// ============================================================================

/**
 * Registry of UI components used by the inspector.
 * Consumers can override any component to customize the inspector's appearance.
 */
export interface InspectorComponents {
  // Card system
  Card: ComponentType<CardProps>
  CardHeader: ComponentType<CardHeaderProps>
  CardTitle: ComponentType<CardTitleProps>
  CardContent: ComponentType<CardContentProps>

  // Primitives
  Button: ComponentType<ButtonProps>
  Textarea: ComponentType<TextareaProps>

  // Table system
  Table: ComponentType<TableProps>
  TableHeader: ComponentType<TableHeaderProps>
  TableBody: ComponentType<TableBodyProps>
  TableRow: ComponentType<TableRowProps>
  TableHead: ComponentType<TableHeadProps>
  TableCell: ComponentType<TableCellProps>

  // Form (for descriptor view)
  Form: ComponentType<FormProps<any>>
}

// ============================================================================
// Context Types
// ============================================================================

export interface InspectorContextValue {
  /** UI component overrides */
  components: InspectorComponents
}

// ============================================================================
// Contexts
// ============================================================================

const ComponentContext = createContext<InspectorComponents | null>(null)
const InspectorContext = createContext<InspectorContextValue | null>(null)

// ============================================================================
// Provider Component
// ============================================================================

export interface InspectorProviderProps extends PropsWithChildren {
  /** Custom component overrides */
  components?: Partial<InspectorComponents>
}

// Import will be provided by consumer or use empty defaults
// This avoids circular dependency issues
const EMPTY_COMPONENTS: InspectorComponents = {
  Card: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }) => <h3 {...props}>{children}</h3>,
  CardContent: ({ children, ...props }) => <div {...props}>{children}</div>,
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
  Textarea: props => <textarea {...props} />,
  Table: ({ children, ...props }) => <table {...props}>{children}</table>,
  TableHeader: ({ children, ...props }) => <thead {...props}>{children}</thead>,
  TableBody: ({ children, ...props }) => <tbody {...props}>{children}</tbody>,
  TableRow: ({ children, ...props }) => <tr {...props}>{children}</tr>,
  TableHead: ({ children, ...props }) => <th {...props}>{children}</th>,
  TableCell: ({ children, ...props }) => <td {...props}>{children}</td>,
  Form: ({ onSubmit, values }) => (
    <form
      onSubmit={e => {
        e.preventDefault()
        onSubmit(values as any)
      }}
    >
      <pre>{JSON.stringify(values, null, 2)}</pre>
      <button type="submit">Submit</button>
    </form>
  ),
}

export function InspectorProvider({ children, components: customComponents }: InspectorProviderProps) {
  // Use empty components as base, override with custom
  const DefaultComponents = EMPTY_COMPONENTS

  // Merge custom components with defaults
  const mergedComponents = useMemo(
    () => ({ ...DefaultComponents, ...customComponents }),
    [DefaultComponents, customComponents]
  )

  const contextValue = useMemo<InspectorContextValue>(() => ({ components: mergedComponents }), [mergedComponents])

  return (
    <ComponentContext.Provider value={mergedComponents}>
      <InspectorContext.Provider value={contextValue}>{children}</InspectorContext.Provider>
    </ComponentContext.Provider>
  )
}

// ============================================================================
// Context Hooks
// ============================================================================

/**
 * Get the component registry.
 * Must be used within an InspectorProvider.
 */
export function useComponents(): InspectorComponents {
  const components = useContext(ComponentContext)
  if (!components) {
    throw new Error('useComponents must be used within an InspectorProvider')
  }
  return components
}

/**
 * Get the full inspector context.
 * Must be used within an InspectorProvider.
 */
export function useInspectorContext(): InspectorContextValue {
  const context = useContext(InspectorContext)
  if (!context) {
    throw new Error('useInspectorContext must be used within an InspectorProvider')
  }
  return context
}
