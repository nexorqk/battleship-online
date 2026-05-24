import type { PlayerGameView } from "@battleship/game-core";
import type { StoredPlayer } from "../storage";

type TurnIndicatorProps = {
  view: PlayerGameView & { version: number };
  player: StoredPlayer;
  isMyTurn: boolean;
  isFinished: boolean;
  placedShipsCount: number;
  timeLeft: number | null;
  turnTimeoutSec: number | null;
};

export function TurnIndicator({
  view,
  player,
  isMyTurn,
  isFinished,
  placedShipsCount,
  timeLeft,
  turnTimeoutSec,
}: TurnIndicatorProps) {
  const isWaiting = view.phase === "waiting";
  const isPlacing = view.phase === "placing";

  return (
    <div className="turn-indicator">
      <span
        className={`turn-dot ${isFinished ? "finished" : isMyTurn ? "" : "waiting"}`}
      />
      <p className="turn-text">
        {isFinished ? (
          <>
            Game over &mdash;{" "}
            <strong>
              {view.winner === player.role
                ? "You won!"
                : `${view.winner === "playerA" ? "Player 1" : "Player 2"} won`}
            </strong>
          </>
        ) : isWaiting ? (
          <>Waiting for opponent<span className="waiting-dots"><span>.</span><span>.</span><span>.</span></span></>
        ) : isPlacing ? (
          <>
            {placedShipsCount === 0
              ? "Select a ship below, then click the board to place it"
              : placedShipsCount < 10
                ? `Place ${10 - placedShipsCount} more ship${10 - placedShipsCount > 1 ? "s" : ""}`
                : "All ships placed. Press Ready to start the battle."}
          </>
        ) : isMyTurn ? (
          <>
            Your turn &mdash; select a target on the enemy board
          </>
        ) : (
          <>
            Opponent&apos;s turn &mdash; wait for their move
          </>
        )}
      </p>

      {/* Timer — only during active phase */}
      {view.phase === "active" && timeLeft !== null && turnTimeoutSec !== null && (
        <div className={`turn-timer ${timeLeft <= 10 ? "urgent" : ""}`}>
          <svg className="timer-ring" viewBox="0 0 40 40" width="40" height="40">
            <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.15" />
            <circle
              cx="20" cy="20" r="17"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(timeLeft / turnTimeoutSec) * 107} 107`}
              transform="rotate(-90 20 20)"
              className="timer-ring-fill"
            />
          </svg>
          <span className="timer-text">{timeLeft}</span>
        </div>
      )}
    </div>
  );
}
