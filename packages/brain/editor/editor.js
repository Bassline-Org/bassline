import { cy, persist } from './graph/index.js'
import './components/index.js'

document.getElementById('sidebar').cy = cy

document.addEventListener('keydown', e => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    cy.$(':selected').remove()
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    persist.save()
  }
})
