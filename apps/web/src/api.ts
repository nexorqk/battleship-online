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

export async function joinGame(gameId: string): Promise<JoinGameResponse> {
  const response = await fetch(`${API_URL}/games/${gameId}/join`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to join game");
  }

  return response.json() as Promise<JoinGameResponse>;
}
