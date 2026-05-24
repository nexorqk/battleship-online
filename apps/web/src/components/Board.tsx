import React from "react";
import type { Cell, Ship, ShotRecord } from "@battleship/game-core";

type BoardProps = {
  title: string;
  ships?: Ship[];
  shots: ShotRecord[];
  disabled?: boolean;
  isEnemy?: boolean;
  myReady?: boolean;
  enemyReady?: boolean;
  onCellClick?: (cell: Cell) => void;
};

const COL_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const ROW_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

export function Board({
  title,
  ships = [],
  shots,
  disabled = false,
  isEnemy = false,
  myReady,
  enemyReady,
  onCellClick,
}: BoardProps) {
  const shotMap = new Map<string, ShotRecord>();
  for (const shot of shots) {
    shotMap.set(`${shot.target.x}:${shot.target.y}`, shot);
  }

  const shipCellSet = new Set<string>();
  for (const ship of ships) {
    for (const cell of ship.cells) {
      shipCellSet.add(`${cell.x}:${cell.y}`);
    }
  }

  function getCellState(x: number, y: number) {
    const key = `${x}:${y}`;
    const shot = shotMap.get(key);
    const hasShip = shipCellSet.has(key);

    if (shot) {
      if (shot.result === "miss") return "miss";
      if (shot.result === "hit") return hasShip ? "ship-hit" : "hit";
      if (shot.result === "sunk") return "sunk";
    }

    if (hasShip) return "ship";
    return "empty";
  }

  function cellLabel(state: string): string {
    if (state === "miss") return "○";
    if (state === "hit" || state === "ship-hit") return "✕";
    if (state === "sunk") return "✕";
    return "";
  }

  return (
    <section className={`board-section ${isEnemy ? "enemy-board" : "my-board"}`}>
      {isEnemy && <div className="radar-overlay" aria-hidden="true" />}

      <div className="board-header">
        <span className="board-title">
          {title}
          {!isEnemy && myReady !== undefined && (
            <span className={`badge ${myReady ? "ready" : ""}`}>
              {myReady ? "READY" : "NOT READY"}
            </span>
          )}
          {isEnemy && enemyReady !== undefined && (
            <span className={`badge ${enemyReady ? "ready" : ""}`}>
              {enemyReady ? "READY" : "NOT READY"}
            </span>
          )}
        </span>
      </div>

      <div className="board-grid with-labels" role="grid" aria-label={title}>
        <div className="coord-label corner" />

        {COL_LABELS.map((label) => (
          <div key={label} className="coord-label col-label">
            {label}
          </div>
        ))}

        {ROW_LABELS.map((rowLabel, y) => (
          <React.Fragment key={`row-${y}`}>
            <div className="coord-label row-label">{rowLabel}</div>

            {COL_LABELS.map((_, x) => {
              const state = getCellState(x, y);
              const label = cellLabel(state);
              // A cell is clickable only on the enemy board, when the board is
              // not disabled (game active + your turn), and the cell is empty.
              const isClickable = isEnemy && !disabled && state === "empty";

              const classNames = [
                "cell",
                state !== "empty" ? state : "",
                state === "ship" && !isEnemy ? "self" : "",
                isClickable ? "clickable" : "disabled",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={`${x}:${y}`}
                  className={classNames}
                  disabled={!isClickable}
                  onClick={() => onCellClick?.({ x, y })}
                  aria-label={`${COL_LABELS[x]}${rowLabel}${state !== "empty" ? `, ${state}` : ""}`}
                  title={`${COL_LABELS[x]}${rowLabel}`}
                  type="button"
                >
                  {label}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}
