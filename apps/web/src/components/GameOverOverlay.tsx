export function GameOverOverlay({
  won,
  myShipsRemaining,
  totalMyShips,
  enemyShipsSunk,
  totalEnemyShips,
  onNewGame,
}: {
  won: boolean;
  myShipsRemaining: number;
  totalMyShips: number;
  enemyShipsSunk: number;
  totalEnemyShips: number;
  onNewGame: () => void;
}) {
  return (
    <div className="overlay-backdrop">
      <div className="overlay-card">
        <div className={`overlay-icon ${won ? "victory" : "defeat"}`}>
          {won ? (
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 7 7 6 9Z" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 17 7 18 9Z" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
          ) : (
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          )}
        </div>

        <h2 className={`overlay-title ${won ? "victory" : "defeat"}`}>
          {won ? "VICTORY" : "DEFEAT"}
        </h2>

        <p className="overlay-subtitle">
          {won
            ? "You destroyed the enemy fleet!"
            : "Your fleet has been destroyed."}
        </p>

        <div className="overlay-stats">
          <div className="overlay-stat">
            <span className="overlay-stat-value">{myShipsRemaining}</span>
            <span className="overlay-stat-label">Your ships<br />remaining</span>
          </div>
          <div className="overlay-stat">
            <span className="overlay-stat-value">{enemyShipsSunk}</span>
            <span className="overlay-stat-label">Enemy ships<br />sunk</span>
          </div>
          <div className="overlay-stat">
            <span className="overlay-stat-value">{totalMyShips - myShipsRemaining}</span>
            <span className="overlay-stat-label">Your ships<br />lost</span>
          </div>
        </div>

        <button className="btn-primary overlay-btn" onClick={onNewGame}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          New Game
        </button>
      </div>
    </div>
  );
}
