// Timers the app can drop all at once. An app stays alive while any timer is pending, so quitting means clearing
// every one of them; keeping them in one place makes that a single call.

type Handle = ReturnType<typeof setTimeout>;

export class Timers {
  private readonly timeouts = new Set<Handle>();
  private readonly intervals = new Set<Handle>();

  after(ms: number, fn: () => void): Handle {
    const h = setTimeout(() => {
      this.timeouts.delete(h);
      fn();
    }, ms);
    this.timeouts.add(h);
    return h;
  }

  every(ms: number, fn: () => void): Handle {
    const h = setInterval(fn, ms);
    this.intervals.add(h);
    return h;
  }

  cancel(h: Handle | undefined): void {
    if (h === undefined) return;
    if (this.timeouts.delete(h)) clearTimeout(h);
    if (this.intervals.delete(h)) clearInterval(h);
  }

  clearAll(): void {
    this.timeouts.forEach((h) => clearTimeout(h));
    this.intervals.forEach((h) => clearInterval(h));
    this.timeouts.clear();
    this.intervals.clear();
  }
}
