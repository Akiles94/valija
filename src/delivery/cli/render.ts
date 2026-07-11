import type { DomainError } from "../../shared/domain/result.js";

export function fail(error: DomainError): never {
  console.error(`error [${error.code}]: ${error.message}`);
  process.exit(1);
}

export function truncate(text: string, max = 80): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1)}…`;
}

export function formatDate(iso: string | null): string {
  return iso === null ? "—" : iso.slice(0, 10);
}
