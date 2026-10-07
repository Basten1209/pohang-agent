/**
 * A tiny functional toolkit. Everything here is pure and total.
 *
 * The planner and the agent are written as compositions of small rules
 * (SICP §2.4 data-directed style): a rule either answers or defers.
 */

/** A rule inspects a context and either answers (`R`) or defers (`undefined`). */
export type Rule<C, R> = (context: C) => R | undefined

/** Combine rules so that the first one that answers wins. */
export const firstOf =
  <C, R>(...rules: ReadonlyArray<Rule<C, R>>): Rule<C, R> =>
  (context) => {
    for (const rule of rules) {
      const answer = rule(context)
      if (answer !== undefined) return answer
    }
    return undefined
  }

/** Like `firstOf`, but the final rule must always answer, so the result is total. */
export const decideWith =
  <C, R>(rules: ReadonlyArray<Rule<C, R>>, otherwise: (context: C) => R) =>
  (context: C): R =>
    firstOf(...rules)(context) ?? otherwise(context)

/** A monoid: an associative `concat` with an `empty` identity. */
export type Monoid<T> = { empty: T; concat: (a: T, b: T) => T }

export const foldMap =
  <A, T>(monoid: Monoid<T>, f: (a: A) => T) =>
  (items: ReadonlyArray<A>): T =>
    items.reduce((acc, item) => monoid.concat(acc, f(item)), monoid.empty)

export const sum = (values: ReadonlyArray<number>) =>
  values.reduce((a, b) => a + b, 0)

export const uniq = <T>(values: ReadonlyArray<T>): T[] => [...new Set(values)]

export const toggle = <T>(values: ReadonlyArray<T>, value: T): T[] =>
  values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value]

export const clamp = (min: number, max: number) => (value: number) =>
  Math.min(max, Math.max(min, value))

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Additive configuration: overlay `patch` on `base` recursively.
 * Arrays and scalars in the patch replace; records merge. Neither input is mutated.
 */
export const deepMerge = <T>(base: T, patch: unknown): T => {
  if (!isRecord(base) || !isRecord(patch)) return (patch ?? base) as T
  const merged: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    merged[key] = key in base ? deepMerge(base[key], value) : value
  }
  return merged as T
}

/** Index a list by a key function. */
export const indexBy = <T, K extends PropertyKey>(
  items: ReadonlyArray<T>,
  key: (item: T) => K,
): Record<K, T> =>
  Object.fromEntries(items.map((item) => [key(item), item])) as Record<K, T>
