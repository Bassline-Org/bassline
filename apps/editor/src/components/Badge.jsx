export default function Badge({ children, variant = 'default', className = '' }) {
  const variantClass = variant !== 'default' ? variant : ''
  return <span className={`badge ${variantClass} ${className}`.trim()}>{children}</span>
}
