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
    const key = `${shot.target.x}:${shot.target.y}`;
    shotMap.set(key, shot);
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

  function cellLabel(x: number, y: number, state: string): string {
    if (state === "miss") return "○";
    if (state === "hit" || state === "ship-hit") return "✕";
    if (state === "sunk") return "✕";
    return "";
  }

  return (
    <section className={`board-section ${isEnemy ? "enemy-board" : "my-board"}`}>
      {isEnemy && (
        <div className="radar-overlay" aria-hidden="true" />
      )}

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
        {/* Corner */}
        <div className="coord-label corner" />

        {/* Column labels */}
        {COL_LABELS.map((label) => (
          <div key={label} className="coord-label col-label">
            {label}
          </div>
        ))}

        {/* Rows */}
        {ROW_LABELS.map((rowLabel, y) => (
          <>
            {/* Row label */}
            <div key={`row-${y}`} className="coord-label row-label">
              {rowLabel}
            </div>

            {/* Cells */}
            {COL_LABELS.map((_, x) => {
              const state = getCellState(x, y);
              const label = cellLabel(x, y, state);

              const classNames = [
                "cell",
                state === "empty" ? "" : state,
                state === "ship" && !isEnemy ? "self" : "",
                state === "ship" && isEnemy ? "" : "",
                state === "empty" || (!isEnemy) || disabled ? "disabled" : "clickable",
                (state === "miss" || state === "hit" || state === "ship-hit" || state === "sunk") ? "disabled" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={`${x}:${y}`}
                  className={classNames}
                  disabled={disabled || !isEnemy || state !== "empty"}
                  onClick={() => onCellClick?.({ x, y })}
                  aria-label={`${COL_LABELS[x]}${rowLabel}${state !== "empty" ? `, ${state}` : ""}`}
                  title={`${COL_LABELS[x]}${rowLabel}`}
                  type="button"
                >
                  {label}
                </button>
              );
            })}
          </>
        ))}
      </div>
    </section>
  );
}
