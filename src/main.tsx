import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'

import { router } from './router'

import './styles.css'

registerSW({ immediate: true })

const container = document.querySelector('#root')
if (!container) throw new Error('Missing #root element')

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
