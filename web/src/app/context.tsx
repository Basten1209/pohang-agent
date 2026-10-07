import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { mapUrl } from '#/core/links'
import type { TripConfig } from '#/core/schema'
import type { TripStore } from './use-trip'

/** Which bottom sheet is open. Place ids open the place detail sheet. */
export type Sheet =
  'demo' | 'evidence' | 'train' | 'taxi' | 'why' | { place: string } | null

type App = TripStore & {
  config: TripConfig
  storage: string
  map: ReturnType<typeof mapUrl>
  sheet: Sheet
  open: (sheet: Sheet) => void
}

const AppContext = createContext<App | null>(null)

export const AppProvider = ({
  config,
  storage,
  store,
  children,
}: {
  config: TripConfig
  storage: string
  store: TripStore
  children: ReactNode
}) => {
  const [sheet, open] = useState<Sheet>(null)
  return (
    <AppContext.Provider
      value={{ ...store, config, storage, map: mapUrl(config), sheet, open }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const app = useContext(AppContext)
  if (!app) throw new Error('useApp outside AppProvider')
  return app
}

export const usePlace = (id: string) => {
  const { config } = useApp()
  return config.places.find((p) => p.id === id)
}
