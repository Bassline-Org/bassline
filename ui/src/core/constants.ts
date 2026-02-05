/**
 * CSS class that prevents keyboard event capture.
 * Add this class to any element (or ancestor) where you want
 * keyboard events to pass through to the element instead of
 * being captured by pane navigation handlers.
 *
 * @example
 * <textarea className={KEYBOARD_NOCAPTURE} />
 * <div className={KEYBOARD_NOCAPTURE}><input /></div>
 */
export const KEYBOARD_NOCAPTURE = 'nocapture'
