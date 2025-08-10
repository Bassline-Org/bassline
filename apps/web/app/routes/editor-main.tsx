import { SimpleEditorFlow } from '~/components/editor-v2/SimpleEditorFlow'
import { useEditorContext } from '~/hooks/useEditorContext'
import '@xyflow/react/dist/style.css'

export default function EditorMain() {
  const { groupState, groupId } = useEditorContext()
  
  console.log('[EditorMain] Rendering with groupId:', groupId)
  console.log('[EditorMain] GroupState contacts:', groupState?.contacts?.size)
  
  if (!groupState) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <div className="text-lg mb-2">Loading editor...</div>
          <div className="animate-spin text-4xl">⚡</div>
        </div>
      </div>
    )
  }
  
  return <SimpleEditorFlow groupState={groupState} groupId={groupId} />
}