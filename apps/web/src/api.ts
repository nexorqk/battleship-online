import type { CreateGameResponse, JoinGameResponse } from "@battleship/shared";
import { API_URL } from "./config";

export async function createGame(): Promise<CreateGameResponse> {
  const response = await fetch(`${API_URL}/games`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to create game");
  }

  return response.json() as Promise<CreateGameResponse>;
}

// Deduplicate in-flight join requests so React StrictMode double-mounts
// (or any other duplicate call) never send two HTTP requests for the same game.
const joinInFlight = new Map<string, Promise<JoinGameResponse>>();

export async function joinGame(gameId: string): Promise<JoinGameResponse> {
  const inFlight = joinInFlight.get(gameId);
  if (inFlight) return inFlight;

  const promise = joinGameImpl(gameId);
  joinInFlight.set(gameId, promise);

  // Clean up the cache entry when the request finishes
  promise
    .then(() => joinInFlight.delete(gameId))
    .catch(() => joinInFlight.delete(gameId));

  return promise;
}

async function joinGameImpl(gameId: string): Promise<JoinGameResponse> {
  const response = await fetch(`${API_URL}/games/${gameId}/join`, {
    method: "POST",
  });

  if (!response.ok) {
    let message = "Failed to join game";
    try {
      const body = await response.json();
      if (body && typeof body.error === "string") {
        message = body.error;
      }
    } catch {
      // ignore parse errors, use default message
    }
    throw new Error(message);
  }

  return response.json() as Promise<JoinGameResponse>;
}
