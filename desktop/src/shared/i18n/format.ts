import type { Language } from "./languages.js";

export function formatDate(date: Date, language: Language): string {
  return new Intl.DateTimeFormat(language === "es" ? "es-ES" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatDateTime(date: Date, language: Language): string {
  return new Intl.DateTimeFormat(language === "es" ? "es-ES" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatCount(count: number, language: Language): string {
  return new Intl.NumberFormat(
    language === "es" ? "es-ES" : "en-US"
  ).format(count);
}

export function formatMinutes(minutes: number, language: Language): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
}
