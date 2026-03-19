// @ts-ignore -- @bassline/react is untyped JSX
import { useSink } from '@bassline/react'

export default function App({ reader, writer }: { reader: any; writer: any }) {
  const msg = useSink(reader, null)

  return (
    <div className="flex h-screen items-center justify-center gap-4">
      <pre className="text-sm">{JSON.stringify(msg, null, 2)}</pre>
      <button
        className="rounded border px-3 py-1 text-sm"
        onClick={() => writer.send({ hello: 'world', t: Date.now() })}
      >
        Send
      </button>
    </div>
  )
}
