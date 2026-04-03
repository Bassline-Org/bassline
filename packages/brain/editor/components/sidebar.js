import { LitElement, html, css } from 'lit'
import './node-form.js'

export class BrainSidebar extends LitElement {
  static properties = {
    cy: { attribute: false },
    _node: { attribute: false },
  }

  static styles = css`
    :host {
      display: block;
      position: absolute;
      top: 16px;
      right: 16px;
      min-width: 220px;
      padding: 16px;
      background: #1e1e2eee;
      border: 1px solid #333;
      border-radius: 8px;
      font-family:
        system-ui,
        -apple-system,
        sans-serif;
      z-index: 10;
    }

    .empty {
      color: #666;
      font-size: 13px;
      margin: 0;
    }

    h3 {
      margin: 0 0 16px 0;
      font-size: 13px;
      font-weight: 500;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  `

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
