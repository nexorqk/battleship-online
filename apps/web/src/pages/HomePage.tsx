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
    <main className="home-page">
      {/* Decorative radar rings */}
      <div className="radar-rings" aria-hidden="true">
        <div className="radar-ring" />
        <div className="radar-ring" />
        <div className="radar-ring" />
        <div className="radar-ring" />
        <div className="radar-ring" />
        <div className="radar-sweep" />
      </div>

      <div className="home-hero">
        <p className="home-eyebrow">Real-time naval combat</p>
        <h1 className="home-title">
          BATTLESHIP
          <span>ONLINE</span>
        </h1>
        <p className="home-subtitle">Browser · 1v1 · No sign-up</p>
      </div>

      <div className="home-card">
        <p>
          Create a game session, share the link with a friend, place your fleet,
          and engage in real-time naval warfare. No account needed.
        </p>

        <button
          className="btn-primary"
          onClick={handleCreateGame}
          disabled={creating}
        >
          {creating ? (
            <>Initializing&hellip;</>
          ) : (
            <>
              Create Game
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>

        {error && <p className="home-error">{error}</p>}
      </div>
    </main>
  );
}
