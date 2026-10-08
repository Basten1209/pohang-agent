import { createContext, useContext } from 'react'
import type { TripConfig } from '#/core/schema'
import type { TripView } from '#/core/view'
import type { SlotId } from '#/core/schema'
import type { AgentUIMessage, ChipAnswer } from '#/server/agent/harness'

export type AgentPart = AgentUIMessage['parts'][number]
export type ToolPart = Extract<AgentPart, { type: `tool-${string}` }>
export type PartOf<Name extends string> = Extract<
  AgentPart,
  { type: `tool-${Name}` }
>

/** What every card can reach: the trip, and the two ways to answer the agent. */
export type ChatContext = {
  config: TripConfig
  view: TripView
  /** Answer an Ask tool (a card). The harness applies it on the server. */
  answer: (tool: string, toolCallId: string, output: unknown) => void
  /** Approve or decline a proposed change. */
  approve: (approvalId: string, approved: boolean) => void
  send: (text: string) => void
  /** Reply with a chip: its sentence as the user's message, plus its value. */
  choose: (slot: SlotId, value: ChipAnswer['value'], say: string) => void
}

const Context = createContext<ChatContext | null>(null)
export const ChatProvider = Context.Provider

export const useChatContext = () => {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('useChatContext outside ChatProvider')
  return ctx
}
