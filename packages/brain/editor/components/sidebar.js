import { LitElement, html } from 'lit'
import './node-form.js'

export class BrainSidebar extends LitElement {
  static properties = {
    cy: { attribute: false },
    _node: { attribute: false },
  }

  _setup() {
    if (!this.cy) return
    this.cy.on('select', 'node', e => {
      this._node = e.target
    })
    this.cy.on('unselect', 'node', () => {
      this._node = null
    })
    this.cy.on('remove', () => {
      this._node = null
    })
    this.cy.on('data', 'node', e => {
      if (e.target.selected()) this.requestUpdate()
    })
  }

  updated(changed) {
    if (changed.has('cy') && this.cy) this._setup()
  }

  render() {
    if (!this._node) return html`<p class="empty">Select a node</p>`
    return html`
      <h3>Node</h3>
      <brain-node-form .node=${this._node}></brain-node-form>
    `
  }
}

customElements.define('brain-sidebar', BrainSidebar)
