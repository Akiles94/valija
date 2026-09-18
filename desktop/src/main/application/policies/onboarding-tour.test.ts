import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES } from "../ports/app-preferences.js";
import {
  markTourSeen,
  nextSlide,
  previousSlide,
  SLIDE_IDS,
  shouldPlayTour,
} from "./onboarding-tour.js";

describe("shouldPlayTour", () => {
  it("plays for an installation that hasn't seen it", () => {
    expect(shouldPlayTour({ ...DEFAULT_PREFERENCES, tourSeen: false })).toBe(true);
  });

  it("does not play once seen", () => {
    expect(shouldPlayTour({ ...DEFAULT_PREFERENCES, tourSeen: true })).toBe(false);
  });
});

describe("slide navigation", () => {
  it("has four slides in a fixed order", () => {
    expect(SLIDE_IDS).toEqual(["slide1", "slide2", "slide3", "slide4"]);
  });

  it("nextSlide advances through all four, then returns null (Get started)", () => {
    expect(nextSlide("slide1")).toBe("slide2");
    expect(nextSlide("slide2")).toBe("slide3");
    expect(nextSlide("slide3")).toBe("slide4");
    expect(nextSlide("slide4")).toBeNull();
  });

  it("previousSlide returns null on the first slide (no Back)", () => {
    expect(previousSlide("slide1")).toBeNull();
    expect(previousSlide("slide2")).toBe("slide1");
  });
});

describe("markTourSeen", () => {
  it("sets tourSeen without touching any other preference", () => {
    const before = { ...DEFAULT_PREFERENCES, theme: "dark" as const, tourSeen: false };
    const after = markTourSeen(before);
    expect(after.tourSeen).toBe(true);
    expect(after.theme).toBe("dark");
  });

  it("replaying (calling it again) does not clear the flag", () => {
    const once = markTourSeen({ ...DEFAULT_PREFERENCES, tourSeen: false });
    const again = markTourSeen(once);
    expect(again.tourSeen).toBe(true);
  });
});
