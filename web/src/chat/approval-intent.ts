type PartLike = {
  type: string
  state?: string
  approval?: { id: string }
}

/** A short yes: "네", "좋아요", "적용해줘", "이 코스로 갈게요", "ok"… */
const yes =
  /^\s*(네|넵|예|응|그래|좋아|좋아요|좋습니다|적용|적용해|그걸로|이걸로|그렇게|이 코스로|갈게|ok|okay|yes|sure|apply|はい|好的|可以)/i

/**
 * The approval a typed or spoken "yes" answers: the change or start the
 * agent is waiting on in its latest message. A different request returns
 * null and, as before, the server treats the wait as declined.
 */
export const approvalAnsweredBy = (
  messages: ReadonlyArray<{ role: string; parts: ReadonlyArray<PartLike> }>,
  text: string,
): string | null => {
  const last = messages.at(-1)
  // Only a short reply is a yes; a longer sentence is a new request.
  if (last?.role !== 'assistant' || text.trim().length > 16 || !yes.test(text))
    return null
  const waiting = last.parts.find(
    (p) => p.state === 'approval-requested' && p.approval,
  )
  return waiting?.approval?.id ?? null
}
