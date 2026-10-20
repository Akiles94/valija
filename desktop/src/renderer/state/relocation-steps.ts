/** Where the move-vault wizard is: choosing, checking, moving, failed, or done. */
export type RelocationStageName = "choose" | "preflight" | "moving" | "moveFailed" | "done";

/** Which of the wizard's three steps to highlight, and whether it is still working. */
export interface RelocationProgress {
  current: 1 | 2 | 3;
  inProgress: boolean;
}

/** D-15: choose→1 · preflight/moveFailed→2 · moving→2 (in progress) · done→3. Decoration over the existing machine — it can never advance a step the machine has not reached. */
export function relocationProgress(stage: RelocationStageName): RelocationProgress {
  switch (stage) {
    case "choose":
      return { current: 1, inProgress: false };
    case "preflight":
    case "moveFailed":
      return { current: 2, inProgress: false };
    case "moving":
      return { current: 2, inProgress: true };
    case "done":
      return { current: 3, inProgress: false };
  }
}
