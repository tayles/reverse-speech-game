import { Link, Outlet, createRootRoute, useRouterState } from '@tanstack/react-router'
import { Home, Library, Settings2, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { requestPersistence } from '@/lib/db'
import { useGameStore } from '@/store/game-store'
import micBadge from '@/assets/mic-badge.png'

function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

const NAV = [
  { to: '/', label: 'Play', icon: Home },
  { to: '/clips', label: 'Clips', icon: Library },
  { to: '/settings', label: 'Setup', icon: Settings2 },
] as const

function RootLayout() {
  const online = useOnline()
  const cleanup = useGameStore((s) => s.cleanupOrphanAudio)
  const path = useRouterState({ select: (s) => s.location.pathname })
  const immersive = path.startsWith('/game/')

  useEffect(() => {
    void requestPersistence()
    void cleanup()
  }, [cleanup])

  return (
    <div className="flex min-h-[100svh] flex-col">
      <header className="safe-top sticky top-0 z-30 border-b border-white/8 bg-[oklch(0.16_0.045_292/0.75)] px-4 pb-3 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40">
            <img src={micBadge} alt="" className="h-11 w-auto shrink-0 drop-shadow-lg" />
            <span className="leading-none">
              <span className="block whitespace-nowrap text-lg font-extrabold tracking-tight sm:text-xl">
                Backwards Brain
              </span>
              <span className="hidden text-xs font-bold text-white/45 min-[380px]:block">
                say it in reverse!
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            {!online && (
              <span className="flex items-center gap-1.5 rounded-full bg-sun/20 px-3 py-1.5 text-xs font-extrabold text-sun ring-1 ring-sun/40">
                <WifiOff className="size-4" />
                <span className="hidden sm:inline">Offline — still works!</span>
              </span>
            )}
            {!immersive && (
              <nav className="flex items-center gap-1 rounded-2xl bg-white/8 p-1 ring-1 ring-white/10">
                {NAV.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className={cn(
                      'flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-extrabold text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40',
                    )}
                    activeProps={{ className: 'bg-grape !text-white shadow' }}
                    activeOptions={{ exact: to === '/' }}
                  >
                    <Icon className="size-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </Link>
                ))}
              </nav>
            )}
          </div>
        </div>
      </header>

      <main className="safe-bottom mx-auto w-full max-w-3xl flex-1 px-4 pt-5">
        <Outlet />
      </main>
    </div>
  )
}

function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-7xl">🙃</p>
      <h1 className="mt-4 text-3xl font-extrabold">?dnuof t&apos;nsaw egap sihT</h1>
      <p className="mt-2 text-lg font-bold text-white/60">(That page wasn&apos;t found)</p>
      <Link
        to="/"
        className="mt-6 inline-flex h-14 items-center rounded-blob bg-grape px-8 text-lg font-extrabold shadow-[0_6px_0_0_oklch(0.42_0.18_300)]"
      >
        Back to the game
      </Link>
    </div>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})
