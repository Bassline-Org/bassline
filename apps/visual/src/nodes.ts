import { Node, Edge } from '@xyflow/react'
import { TextType } from './Flow'

let _id = 0
let _gen = 0
const GEN_MAX = 100
export const freshId = () => {
  if (_id++ >= GEN_MAX) {
    _id = 0
    _gen++
  }
  return `id-${_gen}-${_id}`
}
export const node = (...cfgs: Partial<Node>[]) => {
  let data = {}
  let config: Partial<Node> = {}
  for (const cfg of cfgs) {
    data = { ...data, ...cfg.data }
    config = { ...config, ...cfg }
  }
  return {
    position: { x: 0, y: 0 },
    extent: 'parent',
    id: config.id ?? freshId(),
    ...config,
    data,
  } as Node
}
export const edge = (cfg: Partial<Edge> = {}) =>
  ({
    id: cfg.id ?? freshId(),
    ...cfg,
  }) as Edge
export const text = (style: TextType, text: string) => ({ type: 'text', data: { text, style } })
export const drawn = () => ({ type: 'drawn' })
export const config = () => ({ type: 'config', id: 'config', data: {} })
export const group = (id?: string) => ({ type: 'group', id })
export const dims = (width: number, height: number) => ({ measured: { width, height } })
export const pos = (x: number, y: number) => ({ position: { x, y } })
export const parent = (parentId: string) => ({ parentId })
export const tags = (tags: string) => {
  const tagObj = tags.split('/').reduce((acc, curr) => {
    return { ...acc, [`tag-${curr}`]: true }
  }, {})
  return { data: tagObj }
}
