/** Source of the current time, injected so use cases stay deterministic under test. */
export interface Clock {
  now(): Date;
}

/** Mints opaque unique ids (ULIDs in production) for vaults, projects, items and devices. */
export interface IdGenerator {
  next(): string;
}
