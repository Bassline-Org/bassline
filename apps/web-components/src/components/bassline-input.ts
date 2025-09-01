import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('bassline-input')
export class BasslineInput extends LitElement {
  @property({ type: String }) placeholder = 'Type something...';
  @property({ type: String }) label = 'Input';
  @state() private value = '';
  @state() private isFocused = false;

  static styles = css`
    :host {
      display: block;
      padding: 20px;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      border-radius: 8px;
      color: white;
    }
    
    .input-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    
    label {
      font-weight: bold;
      font-size: 1.1rem;
    }
    
    input {
      padding: 12px 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 6px;
      background: rgba(255,255,255,0.1);
      color: white;
      font-size: 1rem;
      transition: all 0.2s ease;
    }
    
    input::placeholder {
      color: rgba(255,255,255,0.7);
    }
    
    input:focus {
      outline: none;
      border-color: rgba(255,255,255,0.8);
      background: rgba(255,255,255,0.2);
      transform: translateY(-1px);
    }
    
    .value-display {
      margin-top: 15px;
      padding: 10px;
      background: rgba(255,255,255,0.1);
      border-radius: 4px;
      font-family: monospace;
      word-break: break-all;
    }
    
    .char-count {
      font-size: 0.9rem;
      opacity: 0.8;
      text-align: right;
      margin-top: 5px;
    }
  `;

  private handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    this.value = target.value;
  }

  private handleFocus() {
    this.isFocused = true;
  }

  private handleBlur() {
    this.isFocused = false;
  }

  render() {
    return html`
      <div class="input-container">
        <label for="input-${this.label}">${this.label}</label>
        <input
          id="input-${this.label}"
          type="text"
          .value=${this.value}
          .placeholder=${this.placeholder}
          @input=${this.handleInput}
          @focus=${this.handleFocus}
          @blur=${this.handleBlur}
        />
        <div class="char-count">${this.value.length} characters</div>
        ${this.value ? html`
          <div class="value-display">
            <strong>Current value:</strong> "${this.value}"
          </div>
        ` : ''}
      </div>
    `;
  }
}
