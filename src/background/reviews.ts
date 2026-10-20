// Each spec's review, in one storage entry keyed by its shortname. Writes go through one queue, applied in the order
// they came, so the page and the side panel (or two tabs of one spec) never overwrite each other's changes.
import { isReview, type Review, type ReviewComment } from '../logic/review.ts';
import type { SessionArea } from './tabs.ts';

const key = (shortname: string) => `review:${shortname}`;

export class ReviewStore {
  private area: SessionArea;
  private now: () => number;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(area: SessionArea, now: () => number) {
    this.area = area;
    this.now = now;
  }

  // A stored review that doesn't fit the types (one another version of the extension stored, e.g.) reads as none.
  async get(shortname: string): Promise<Review | undefined> {
    const value = (await this.area.get(key(shortname)))[key(shortname)];
    return isReview(value) ? value : undefined;
  }

  // Replaces the comment with the same id in place, or else adds it.
  save(shortname: string, title: string, comment: ReviewComment): Promise<Review> {
    return this.write(async () => {
      const comments = [...((await this.get(shortname))?.comments ?? [])];
      const i = comments.findIndex((c) => c.id === comment.id);
      if (i >= 0) comments[i] = comment;
      else comments.push(comment);
      return this.put({ shortname, title, comments });
    });
  }

  // A review whose last comment goes is removed.
  remove(shortname: string, id: string): Promise<Review | undefined> {
    return this.write(async () => {
      const review = await this.get(shortname);
      if (!review) return undefined;
      const comments = review.comments.filter((c) => c.id !== id);
      if (comments.length === 0) {
        await this.area.remove(key(shortname));
        return undefined;
      }
      return this.put({ ...review, comments });
    });
  }

  clear(shortname: string): Promise<void> {
    return this.write(() => this.area.remove(key(shortname)));
  }

  markFiled(shortname: string, ids: string[]): Promise<Review | undefined> {
    return this.write(async () => {
      const review = await this.get(shortname);
      if (!review) return undefined;
      const at = this.now();
      const comments = review.comments.map((c) => (ids.includes(c.id) ? { ...c, filed: at } : c));
      return this.put({ ...review, comments });
    });
  }

  private async put(review: Review): Promise<Review> {
    await this.area.set({ [key(review.shortname)]: review });
    return review;
  }

  // One write at a time, and a failed one doesn't stop the writes after it.
  private write<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job, job);
    this.queue = run.catch(() => {});
    return run;
  }
}
