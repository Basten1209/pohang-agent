/**
 * Tools the agent uses to ask the user. They have no `execute`: the UI
 * renders a card and the answer comes back as the tool output. Kept in its
 * own module so the client can import it without the tool implementations.
 */
export const askTools = ['ask_quick_reply', 'await_progress'] as const
export type AskTool = (typeof askTools)[number]
