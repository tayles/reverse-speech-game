import { createRouter, createHashHistory } from '@tanstack/react-router'

import { Route as rootRoute } from './routes/__root'
import { Route as clipsRoute } from './routes/clips'
import { Route as gameRoute } from './routes/game'
import { Route as indexRoute } from './routes/index'
import { Route as newGameRoute } from './routes/new'
import { Route as settingsRoute } from './routes/settings'

const routeTree = rootRoute.addChildren([
  indexRoute,
  newGameRoute,
  gameRoute,
  clipsRoute,
  settingsRoute,
])

/**
 * Hash history keeps deep links working when the PWA is opened from the home
 * screen, served from a subfolder, or loaded straight off the filesystem.
 */
export const router = createRouter({
  routeTree,
  history: createHashHistory(),
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
