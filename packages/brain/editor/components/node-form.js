import { LitElement, html, css } from 'lit'

export class BrainNodeForm extends LitElement {
  static properties = {
    node: { attribute: false },
  }

  static styles = css`
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    :host {
      display: block;
    }

    label {
      display: block;
      margin-bottom: 12px;
      font-size: 12px;
      color: #aaa;
    }

    input[type='text'] {
      display: block;
      width: 100%;
      margin-top: 4px;
      padding: 6px 8px;
      background: #2a2a3a;
      border: 1px solid #444;
      border-radius: 4px;
      color: #e0e0e0;
      font-size: 13px;
      outline: none;
    }

    input[type='text']:focus {
      border-color: #6a8a96;
    }

    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      font-size: 13px;
      color: #e0e0e0;
    }

    .id {
      font-size: 11px;
      color: #666;
      word-break: break-all;
    }
  `

  _update(key, value) {
    this.node.data(key, value)
    this.requestUpdate()
  }

  render() {
    if (!this.node) return html``
    const d = this.node.data()
    return html`
      <label
        >Label
        <input type="text" .value=${d.label || ''} @input=${e => this._update('label', e.target.value)} />
      </label>
      <label
        >Type
        <input type="text" .value=${d.type || ''} @input=${e => this._update('type', e.target.value)} />
      </label>
      <div class="checkbox-row">
        <input type="checkbox" ?checked=${d.live} @change=${e => this._update('live', e.target.checked)} />
        Live
      </div>
      <div class="id">${d.id}</div>
    `
  }
}

customElements.define('brain-node-form', BrainNodeForm)
