import { cy, persist } from './graph/index.js'
import './components/index.js'

import '@awesome.me/webawesome/dist/styles/webawesome.css'
import '@awesome.me/webawesome/dist/components/spinner/spinner.js'
import '@awesome.me/webawesome/dist/styles/themes/awesome.css'

document.getElementById('sidebar').cy = cy

window.addEventListener('resize', () => cy.center())
document.addEventListener('keydown', e => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    //cy.$(':selected').remove()
    cy.elements(':selected').toggleClass('hidden')
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    persist.save()
  }
})
