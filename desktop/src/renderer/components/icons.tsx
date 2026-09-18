/**
 * The sidebar/breadcrumb icon set (GUI-LAYOUT D-P3), kept in one file so the
 * "no `xmlns`" rule (fact 7 — it would fail `no-network-surface.test.ts`) has
 * one place to check. Every icon is decorative: `aria-hidden="true"` and no
 * `<title>`, which is also what keeps Biome's `a11y/noSvgWithoutTitle` quiet.
 */

export function BrandMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <rect
        x="3"
        y="7"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
      />
      <path
        d="M7 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" fill="currentColor" />
      <rect x="9" y="1" width="6" height="6" fill="currentColor" />
      <rect x="1" y="9" width="6" height="6" fill="currentColor" />
      <rect x="9" y="9" width="6" height="6" fill="currentColor" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" fill="none" strokeWidth="1.5" />
      <line x1="10" y1="10" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ConnectIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M5 9l-2 2a2.5 2.5 0 0 0 3.5 3.5l2-2M11 7l2-2a2.5 2.5 0 0 0-3.5-3.5l-2 2M5.5 10.5l5-5"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SyncIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M2 8a6 6 0 0 1 10-4.5M14 8a6 6 0 0 1-10 4.5"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M12 3.5v2.5H9.5M4 12.5V10h2.5" stroke="currentColor" fill="none" strokeWidth="1.5" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect
        x="3"
        y="7"
        width="10"
        height="7"
        rx="1"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
      />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" fill="none" strokeWidth="1.5" />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" fill="none" strokeWidth="1.5" />
      <path
        d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ProjectIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M1.5 4a1 1 0 0 1 1-1h3l1.5 2h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-10.5a1 1 0 0 1-1-1z"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function ArrowLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M9 2.5L3.5 7 9 11.5"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M5 2.5L10.5 7 5 11.5"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SortArrowIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path
        d="M5 1.5v7M2 5.5L5 8.5 8 5.5"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
