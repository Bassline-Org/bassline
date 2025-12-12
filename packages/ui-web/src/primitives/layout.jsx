/**
 * Layout Primitives
 *
 * Layout combinators that compose children spatially.
 */

import React from 'react'

/**
 * Box - Basic container
 * @param {object} props
 * @param {object} [props.style] - CSS styles
 * @param {string} [props.className] - CSS class name
 * @param {React.ReactNode} props.children
 */
export function Box({ style, className, children }) {
  return (
    <div style={style} className={className}>
      {children}
    </div>
  )
}

/**
 * Stack - Flex-based vertical or horizontal layout
 * @param {object} props
 * @param {'vertical'|'horizontal'} [props.direction='vertical'] - Stack direction
 * @param {number|string} [props.gap=0] - Gap between children
 * @param {'start'|'center'|'end'|'stretch'} [props.align] - Cross-axis alignment
 * @param {'start'|'center'|'end'|'between'|'around'} [props.justify] - Main-axis justification
 * @param {object} [props.style] - Additional CSS styles
 * @param {string} [props.className] - CSS class name
 * @param {React.ReactNode} props.children
 */
export function Stack({
  direction = 'vertical',
  gap = 0,
  align,
  justify,
  style,
  className,
  children,
}) {
  const alignItems = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    stretch: 'stretch',
  }[align]

  const justifyContent = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    between: 'space-between',
    around: 'space-around',
  }[justify]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: direction === 'horizontal' ? 'row' : 'column',
        gap: typeof gap === 'number' ? `${gap}px` : gap,
        alignItems,
        justifyContent,
        ...style,
      }}
      className={className}
    >
      {children}
    </div>
  )
}

/**
 * Grid - CSS grid layout
 * @param {object} props
 * @param {string} [props.columns] - Grid columns template (e.g., '1fr 1fr' or '200px auto')
 * @param {string} [props.rows] - Grid rows template
 * @param {number|string} [props.gap=0] - Gap between cells
 * @param {object} [props.style] - Additional CSS styles
 * @param {string} [props.className] - CSS class name
 * @param {React.ReactNode} props.children
 */
export function Grid({ columns, rows, gap = 0, style, className, children }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: columns,
        gridTemplateRows: rows,
        gap: typeof gap === 'number' ? `${gap}px` : gap,
        ...style,
      }}
      className={className}
    >
      {children}
    </div>
  )
}

/**
 * Scroll - Scrollable area
 * @param {object} props
 * @param {'vertical'|'horizontal'|'both'} [props.direction='vertical'] - Scroll direction
 * @param {string} [props.maxHeight] - Maximum height
 * @param {string} [props.maxWidth] - Maximum width
 * @param {object} [props.style] - Additional CSS styles
 * @param {string} [props.className] - CSS class name
 * @param {React.ReactNode} props.children
 */
export function Scroll({
  direction = 'vertical',
  maxHeight,
  maxWidth,
  style,
  className,
  children,
}) {
  const overflowStyle = {
    vertical: { overflowY: 'auto', overflowX: 'hidden' },
    horizontal: { overflowX: 'auto', overflowY: 'hidden' },
    both: { overflow: 'auto' },
  }[direction]

  return (
    <div
      style={{
        ...overflowStyle,
        maxHeight,
        maxWidth,
        ...style,
      }}
      className={className}
    >
      {children}
    </div>
  )
}

/**
 * Center - Center children
 * @param {object} props
 * @param {object} [props.style] - Additional CSS styles
 * @param {string} [props.className] - CSS class name
 * @param {React.ReactNode} props.children
 */
export function Center({ style, className, children }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
      className={className}
    >
      {children}
    </div>
  )
}

/**
 * Register layout primitives with a widget registry
 * @param {object} registry - Widget registry from @bassline/widgets
 */
export function registerLayoutPrimitives(registry) {
  registry.registerPrimitive('box', {
    type: 'bl:///types/widgets/layout/box',
    props: {
      style: { type: 'object' },
      className: { type: 'string' },
    },
    render: Box,
  })

  registry.registerPrimitive('stack', {
    type: 'bl:///types/widgets/layout/stack',
    props: {
      direction: { type: 'string', default: 'vertical' },
      gap: { type: 'number', default: 0 },
      align: { type: 'string' },
      justify: { type: 'string' },
      style: { type: 'object' },
      className: { type: 'string' },
    },
    render: Stack,
  })

  registry.registerPrimitive('grid', {
    type: 'bl:///types/widgets/layout/grid',
    props: {
      columns: { type: 'string' },
      rows: { type: 'string' },
      gap: { type: 'number', default: 0 },
      style: { type: 'object' },
      className: { type: 'string' },
    },
    render: Grid,
  })

  registry.registerPrimitive('scroll', {
    type: 'bl:///types/widgets/layout/scroll',
    props: {
      direction: { type: 'string', default: 'vertical' },
      maxHeight: { type: 'string' },
      maxWidth: { type: 'string' },
      style: { type: 'object' },
      className: { type: 'string' },
    },
    render: Scroll,
  })

  registry.registerPrimitive('center', {
    type: 'bl:///types/widgets/layout/center',
    props: {
      style: { type: 'object' },
      className: { type: 'string' },
    },
    render: Center,
  })
}
