const defaultUrl = import.meta.env.PROD ? "" : "http://localhost:4000";
export const API_URL = import.meta.env.VITE_API_URL ?? defaultUrl;
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? defaultUrl;

export const TURN_TIMER_SECONDS = parseOptionalPositiveInt(
  import.meta.env.VITE_TURN_TIMER_SECONDS,
);

function parseOptionalPositiveInt(value: unknown): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;

  return parsed;
}
