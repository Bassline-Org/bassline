import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('bassline-counter')
export class BasslineCounter extends LitElement {
  @property()
  count;

  static styles = css`
    :host {
      display: block;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 8px;
      color: white;
      text-align: center;
    }
    
    .counter-display {
      font-size: 3rem;
      font-weight: bold;
      margin: 20px 0;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
    
    .counter-controls {
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
    }
    
    button {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      background: rgba(255,255,255,0.2);
      color: white;
      cursor: pointer;
      font-size: 1rem;
      transition: all 0.2s ease;
    }
    
    button:hover {
      background: rgba(255,255,255,0.3);
      transform: translateY(-2px);
    }
    
    button:active {
      transform: translateY(0);
    }
    
    .reset-btn {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.3);
    }
  `;

  constructor() {
    super();
    this.count = 0;
  }

  render() {
    return html`
      <div class="counter-display">${this.count}</div>
      <div class="counter-controls">
        <button @click=${() => this.count = this.count - 1}>-</button>
        <button @click=${() => this.count = this.count + 1}>+</button>
      </div>
    `;
  }
}
