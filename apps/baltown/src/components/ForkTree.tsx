import { Show, For, createMemo, createResource } from 'solid-js'
import { A } from '@solidjs/router'
import { useBassline } from '@bassline/solid'

interface ForkTreeProps {
  /** Current val URI (bl:///vals/owner/name format) */
  valUri: string
  /** Parent val URI if this is a fork */
  parentVal?: string
  /** Current val's owner */
  owner: string
  /** Current val's name */
  name: string
}

interface ValInfo {
  owner: string
  name: string
  uri: string
  parentVal?: string
}

/**
 * ForkTree - Visualize fork relationships
 *
 * Shows:
 * - Ancestry chain (parent vals)
 * - Sibling forks (other forks of same parent)
 * - Child forks (forks of this val)
 */
export default function ForkTree(props: ForkTreeProps) {
  const bl = useBassline()

  // Parse val info from URI
  const parseValUri = (uri: string): ValInfo | null => {
    // Handle both bl:///vals/owner/name and bl:///r/vals/owner/name
    const match = uri.match(/bl:\/\/\/(?:r\/)?vals\/([^/]+)\/([^/]+)/)
    if (!match) return null
    return {
      owner: match[1],
      name: match[2],
      uri: `bl:///r/vals/${match[1]}/${match[2]}`
    }
  }

  // Fetch forks of this val (backlinks)
  const [forks] = createResource(
    () => props.valUri,
    async (uri) => {
      try {
        // Query backlinks - what references this val?
        const response = await bl.get(`bl:///links/to/r/vals/${props.owner}/${props.name}`)
        if (!response?.body?.links) return []

        // Filter to only parentVal references (forks)
        const forkLinks = response.body.links.filter((link: any) =>
          link.path === 'parentVal' || link.path === 'body.parentVal'
        )

        // Parse URIs and fetch val info
        const forkInfos = await Promise.all(
          forkLinks.map(async (link: any) => {
            const parsed = parseValUri(link.from)
            if (!parsed) return null
            try {
              const val = await bl.get(parsed.uri)
              return {
                ...parsed,
                description: val?.body?.description,
                valType: val?.body?.valType
              }
            } catch {
              return parsed
            }
          })
        )

        return forkInfos.filter(Boolean)
      } catch (err) {
        console.error('Failed to fetch forks:', err)
        return []
      }
    }
  )

  // Fetch parent val info if exists
  const [parentInfo] = createResource(
    () => props.parentVal,
    async (parentUri) => {
      if (!parentUri) return null
      const parsed = parseValUri(parentUri)
      if (!parsed) return null
      try {
        const val = await bl.get(parsed.uri)
        return {
          ...parsed,
          description: val?.body?.description,
          valType: val?.body?.valType,
          parentVal: val?.body?.parentVal
        }
      } catch {
        return parsed
      }
    }
  )

  // Fetch siblings (other forks of same parent)
  const [siblings] = createResource(
    () => props.parentVal,
    async (parentUri) => {
      if (!parentUri) return []
      const parentParsed = parseValUri(parentUri)
      if (!parentParsed) return []

      try {
        const response = await bl.get(`bl:///links/to/r/vals/${parentParsed.owner}/${parentParsed.name}`)
        if (!response?.body?.links) return []

        const siblingLinks = response.body.links.filter((link: any) =>
          (link.path === 'parentVal' || link.path === 'body.parentVal') &&
          !link.from.includes(`/${props.owner}/${props.name}`)
        )

        const siblingInfos = await Promise.all(
          siblingLinks.map(async (link: any) => {
            const parsed = parseValUri(link.from)
            if (!parsed) return null
            try {
              const val = await bl.get(parsed.uri)
              return {
                ...parsed,
                valType: val?.body?.valType
              }
            } catch {
              return parsed
            }
          })
        )

        return siblingInfos.filter(Boolean)
      } catch {
        return []
      }
    }
  )

  // Build ancestry chain
  const [ancestry] = createResource(
    () => props.parentVal,
    async (parentUri) => {
      if (!parentUri) return []

      const chain: ValInfo[] = []
      let currentUri = parentUri

      // Walk up the chain (limit to prevent infinite loops)
      for (let i = 0; i < 10 && currentUri; i++) {
        const parsed = parseValUri(currentUri)
        if (!parsed) break

        try {
          const val = await bl.get(parsed.uri)
          chain.push({
            ...parsed,
            parentVal: val?.body?.parentVal
          })
          currentUri = val?.body?.parentVal
        } catch {
          chain.push(parsed)
          break
        }
      }

      return chain.reverse() // Root first
    }
  )

  const hasForks = createMemo(() => (forks() || []).length > 0)
  const hasSiblings = createMemo(() => (siblings() || []).length > 0)
  const hasAncestry = createMemo(() => (ancestry() || []).length > 0)
  const hasContent = createMemo(() => hasForks() || hasSiblings() || hasAncestry())

  return (
    <Show when={hasContent()}>
      <div class="fork-tree">
        <h4 class="tree-title">Fork Tree</h4>

        {/* Ancestry chain */}
        <Show when={hasAncestry()}>
          <div class="tree-section">
            <span class="section-label">Ancestry</span>
            <div class="ancestry-chain">
              <For each={ancestry()}>
                {(ancestor, i) => (
                  <>
                    <A href={`/v/${ancestor.owner}/${ancestor.name}`} class="ancestor-node">
                      <span class="node-owner">{ancestor.owner}/</span>
                      <span class="node-name">{ancestor.name}</span>
                    </A>
                    <span class="chain-arrow">→</span>
                  </>
                )}
              </For>
              <span class="current-node">
                <span class="node-owner">{props.owner}/</span>
                <span class="node-name">{props.name}</span>
              </span>
            </div>
          </div>
        </Show>

        {/* Siblings */}
        <Show when={hasSiblings()}>
          <div class="tree-section">
            <span class="section-label">Siblings ({siblings()?.length} other forks)</span>
            <div class="node-list">
              <For each={siblings()}>
                {(sibling) => (
                  <A href={`/v/${sibling.owner}/${sibling.name}`} class="tree-node sibling">
                    <span class="node-icon">⤴</span>
                    <span class="node-owner">{sibling.owner}/</span>
                    <span class="node-name">{sibling.name}</span>
                    <Show when={sibling.valType}>
                      <span class={`node-type ${sibling.valType}`}>{sibling.valType}</span>
                    </Show>
                  </A>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Child forks */}
        <Show when={hasForks()}>
          <div class="tree-section">
            <span class="section-label">Forks ({forks()?.length})</span>
            <div class="node-list">
              <For each={forks()}>
                {(fork) => (
                  <A href={`/v/${fork.owner}/${fork.name}`} class="tree-node fork">
                    <span class="node-icon">⤵</span>
                    <span class="node-owner">{fork.owner}/</span>
                    <span class="node-name">{fork.name}</span>
                    <Show when={fork.valType}>
                      <span class={`node-type ${fork.valType}`}>{fork.valType}</span>
                    </Show>
                  </A>
                )}
              </For>
            </div>
          </div>
        </Show>

        <Show when={!hasContent()}>
          <div class="empty-tree">No fork relationships</div>
        </Show>

        <style>{`
          .fork-tree {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 8px;
            padding: 16px;
          }

          .tree-title {
            font-size: 14px;
            font-weight: 600;
            color: #f0f6fc;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid #30363d;
          }

          .tree-section {
            margin-bottom: 16px;
          }

          .tree-section:last-child {
            margin-bottom: 0;
          }

          .section-label {
            font-size: 11px;
            font-weight: 600;
            color: #8b949e;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: block;
            margin-bottom: 8px;
          }

          .ancestry-chain {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 4px;
            padding: 8px 12px;
            background: #0d1117;
            border-radius: 6px;
          }

          .ancestor-node {
            display: inline-flex;
            color: #58a6ff;
            text-decoration: none;
            font-size: 13px;
          }

          .ancestor-node:hover {
            text-decoration: underline;
          }

          .chain-arrow {
            color: #484f58;
            font-size: 12px;
            margin: 0 2px;
          }

          .current-node {
            display: inline-flex;
            font-size: 13px;
            font-weight: 600;
            color: #f0f6fc;
            background: #238636;
            padding: 2px 8px;
            border-radius: 4px;
          }

          .current-node .node-owner {
            color: rgba(255, 255, 255, 0.7);
            font-weight: 400;
          }

          .node-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .tree-node {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: #0d1117;
            border-radius: 6px;
            text-decoration: none;
            transition: background 0.2s;
          }

          .tree-node:hover {
            background: #21262d;
          }

          .node-icon {
            font-size: 12px;
            color: #8b949e;
          }

          .tree-node.fork .node-icon {
            color: #3fb950;
          }

          .tree-node.sibling .node-icon {
            color: #a371f7;
          }

          .node-owner {
            font-size: 13px;
            color: #8b949e;
          }

          .node-name {
            font-size: 13px;
            color: #58a6ff;
          }

          .node-type {
            margin-left: auto;
            font-size: 11px;
            padding: 2px 6px;
            border-radius: 10px;
            background: #21262d;
            color: #8b949e;
          }

          .node-type.propagator {
            background: #1f6feb33;
            color: #58a6ff;
          }

          .node-type.recipe {
            background: #23863633;
            color: #3fb950;
          }

          .node-type.handler {
            background: #a371f733;
            color: #a371f7;
          }

          .node-type.cell {
            background: #f8514933;
            color: #f85149;
          }

          .empty-tree {
            text-align: center;
            color: #8b949e;
            font-size: 13px;
            padding: 12px;
          }
        `}</style>
      </div>
    </Show>
  )
}
