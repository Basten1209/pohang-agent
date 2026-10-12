import { askTools } from '#/server/agent/ask-tools'

type PartLike = {
  type: string
  toolCallId?: string
  state?: string
  output?: unknown
  approval?: unknown
}

/**
 * The message the client sends for a turn.
 *
 * A user message goes as is. An assistant message is sent back only to
 * answer its open cards and approvals, and the server reads nothing else from
 * it (see `mergeIncoming`), so send just those answers. The full message
 * carries every tool result of the turn — planning context, itineraries,
 * reasoning — and outgrew the request limit, so approving a change failed.
 */
export const outgoing = <
  M extends { role: string; parts: ReadonlyArray<PartLike> },
>(
  message: M,
): M =>
  message.role !== 'assistant'
    ? message
    : {
        ...message,
        parts: message.parts.flatMap((p): PartLike[] => {
          if (!p.toolCallId) return []
          if (p.state === 'approval-responded')
            return [
              {
                type: p.type,
                toolCallId: p.toolCallId,
                state: p.state,
                approval: p.approval,
              },
            ]
          if (
            p.state === 'output-available' &&
            (askTools as readonly string[]).includes(p.type.slice(5))
          )
            return [
              {
                type: p.type,
                toolCallId: p.toolCallId,
                state: p.state,
                output: p.output,
              },
            ]
          return []
        }),
      }
