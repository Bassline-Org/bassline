import { LitElement, html } from 'lit'

export class GraphList extends LitElement {
  static properties = {
    names: { attribute: false },
  }

  connectedCallback() {
    super.connectedCallback()
    if (!this.names) this._load()
  }

  async _load() {
    const res = await fetch('/api/graphs/')
    this.names = await res.json()
  }

  render() {
    if (!this.names) return html`<wa-spinner></wa-spinner>`

    return html`
      <ul>
        ${this.names.map(name => html`<li>${name}</li>`)}
      </ul>
    `
  }
}

customElements.define('graph-list', GraphList)
