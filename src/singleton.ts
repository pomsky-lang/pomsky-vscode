export interface Singleton<T, C extends unknown[]> {
  readonly getOrInit: Getter<T, C>
  readonly dispose: () => void
}

export type Getter<T, C extends unknown[]> = (...context: C) => T

/**
 * Create a singleton that is initialized on first use; after that, the previous,
 * cached instance is returned.
 */
export function singleton<T, C extends unknown[] = []>(init: Getter<T, C>): Singleton<T, C> {
  let cached: T | undefined
  return {
    getOrInit(...context: C) {
      if (!cached) {
        cached = init(...context)
      }
      return cached
    },
    dispose() {
      cached = undefined
    },
  }
}
