import { useState } from "react";
import {
  nextSlide,
  previousSlide,
  SLIDE_IDS,
  type SlideId,
} from "../../main/application/policies/onboarding-tour.js";
import type { TranslationKey } from "../../shared/i18n/translate.js";
import { useT } from "../state/i18n-context.js";

const SLIDE_COPY: Record<SlideId, { title: TranslationKey; body: TranslationKey }> = {
  slide1: { title: "onboarding.slide1Title", body: "onboarding.slide1Body" },
  slide2: { title: "onboarding.slide2Title", body: "onboarding.slide2Body" },
  slide3: { title: "onboarding.slide3Title", body: "onboarding.slide3Body" },
  slide4: { title: "onboarding.slide4Title", body: "onboarding.slide4Body" },
};

/**
 * §4.2 step 7', D-U(a)–(c). Plays the ordered slide list from
 * `policies/onboarding-tour.ts` — the sequence and skip semantics are
 * already unit-tested headlessly there, so this component only renders the
 * current slide and calls `onDone` once, from either Skip or the last
 * slide's "Get started" (D-U(b)'s rider: both mark the tour seen — a
 * skipped tour never nags again, so there is nothing for this component to
 * distinguish between the two outcomes). It opens no vault session, reads
 * no vault content, makes no network request, does not touch the idle-lock
 * clock, and writes nothing itself — the caller persists `tourSeen`.
 */
export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [slide, setSlide] = useState<SlideId>(SLIDE_IDS[0]);
  const copy = SLIDE_COPY[slide];
  const previous = previousSlide(slide);
  const next = nextSlide(slide);

  return (
    <div className="screen onboarding">
      <h1>{t(copy.title)}</h1>
      <p>{t(copy.body)}</p>
      <div className="slide-dots">
        {SLIDE_IDS.map((id) => (
          <span key={id} className={id === slide ? "dot active" : "dot"} />
        ))}
      </div>
      <div className="actions">
        {previous !== null && (
          <button type="button" onClick={() => setSlide(previous)}>
            {t("common.back")}
          </button>
        )}
        {next !== null ? (
          <button type="button" onClick={() => setSlide(next)}>
            {t("common.next")}
          </button>
        ) : (
          <button type="button" onClick={onDone}>
            {t("onboarding.getStarted")}
          </button>
        )}
        <button type="button" onClick={onDone}>
          {t("common.skip")}
        </button>
      </div>
    </div>
  );
}
