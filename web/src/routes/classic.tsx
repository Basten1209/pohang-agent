import { createFileRoute } from '@tanstack/react-router'
import { App } from '#/app/app'
import { useMemo } from 'react'
import { Loading, loadConfig } from '#/app/load-config'
import { localizeConfig } from '#/i18n/config'
import { useI18n } from '#/i18n/react'

/** The screen-by-screen UI, on the same server-held trip as the chat. */
export const Route = createFileRoute('/classic')({
  ssr: false,
  loader: loadConfig,
  pendingComponent: Loading,
  component: Classic,
})

function Classic() {
  const { config, storage } = Route.useLoaderData()
  const { locale } = useI18n()
  const localized = useMemo(
    () => localizeConfig(config, locale),
    [config, locale],
  )
  return <App config={localized} storage={storage} />
}
