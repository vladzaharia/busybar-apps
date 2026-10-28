// Random choices for apps: a shuffle bag, so "random" feels random but never starves an option.

/**
 * Returns a function that draws from `items` in random order, one full round at a time: every item comes up once per
 * round, in a fresh order each round. `random` is Math.random unless a test passes its own.
 */
export function shuffleBag<T>(items: readonly T[], random: () => number = Math.random): () => T {
  if (!items.length) throw new Error("shuffleBag: no items");
  let bag: T[] = [];
  return () => {
    if (!bag.length) {
      bag = items.slice();
      // Fisher-Yates.
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        const swap = bag[i]!;
        bag[i] = bag[j]!;
        bag[j] = swap;
      }
    }
    return bag.pop()!;
  };
}
