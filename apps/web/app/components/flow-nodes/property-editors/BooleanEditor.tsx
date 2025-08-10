interface BooleanEditorProps {
  value: boolean
  onChange: (value: boolean) => void
}

export function BooleanEditor({ value, onChange }: BooleanEditorProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(false)}
        className={`px-3 py-1 text-sm rounded transition-colors ${
          !value 
            ? 'bg-red-500 text-white' 
            : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
        }`}
        type="button"
      >
        False
      </button>
      <button
        onClick={() => onChange(true)}
        className={`px-3 py-1 text-sm rounded transition-colors ${
          value 
            ? 'bg-green-500 text-white' 
            : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
        }`}
        type="button"
      >
        True
      </button>
    </div>
  )
}