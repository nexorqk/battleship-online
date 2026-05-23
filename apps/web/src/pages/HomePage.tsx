import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createGame } from "../api";
import { storePlayer } from "../storage";

export function HomePage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreateGame() {
    setCreating(true);
    setError(null);

    try {
      const game = await createGame();
      storePlayer(game.gameId, {
        playerToken: game.playerToken,
        role: game.role,
      });

      navigate(`/game/${game.gameId}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="page">
      <div className="hero">
        <p className="eyebrow">Browser 1v1 MVP</p>
        <h1>Battleship Online</h1>
        <p>
          Создай сессию, отправь ссылку второму игроку, расставь корабли и играй в реальном времени.
        </p>

        <button className="primary-button" onClick={handleCreateGame} disabled={creating}>
          {creating ? "Creating..." : "Create game"}
        </button>

        {error && <p className="error">{error}</p>}
      </div>
    </main>
  );
}
