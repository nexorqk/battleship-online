export type StoredPlayer = {
  playerToken: string;
  role: "playerA" | "playerB";
};

export function getStoredPlayer(gameId: string): StoredPlayer | null {
  const raw = localStorage.getItem(storageKey(gameId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredPlayer;
  } catch {
    return null;
  }
}

export function storePlayer(gameId: string, player: StoredPlayer): void {
  localStorage.setItem(storageKey(gameId), JSON.stringify(player));
}

function storageKey(gameId: string): string {
  return `battleship:${gameId}:player`;
}
