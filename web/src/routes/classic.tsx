import { createFileRoute } from '@tanstack/react-router'
import { App } from '#/app/app'
import { Loading, loadConfig } from '#/app/load-config'

/** The screen-by-screen UI, on the same server-held trip as the chat. */
export const Route = createFileRoute('/classic')({
  ssr: false,
  loader: loadConfig,
  pendingComponent: Loading,
  component: Classic,
})

function Classic() {
  const { config, storage } = Route.useLoaderData()
  return <App config={config} storage={storage} />
}
