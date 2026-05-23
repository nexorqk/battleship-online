import type { Cell, Ship, ShotRecord } from "@battleship/game-core";

type BoardProps = {
  title: string;
  ships?: Ship[];
  shots: ShotRecord[];
  disabled?: boolean;
  onCellClick?: (cell: Cell) => void;
};

export function Board({ title, ships = [], shots, disabled = false, onCellClick }: BoardProps) {
  return (
    <section className="board-section">
      <h2>{title}</h2>
      <div className="board">
        {Array.from({ length: 100 }).map((_, index) => {
          const x = index % 10;
          const y = Math.floor(index / 10);
          const cell = { x, y };

          const hasShip = ships.some((ship) =>
            ship.cells.some((shipCell) => shipCell.x === x && shipCell.y === y),
          );

          const shot = shots.find((record) => record.target.x === x && record.target.y === y);

          const className = [
            "cell",
            hasShip ? "ship" : "",
            shot?.result === "miss" ? "miss" : "",
            shot?.result === "hit" ? "hit" : "",
            shot?.result === "sunk" ? "sunk" : "",
            disabled ? "disabled" : "clickable",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={`${x}:${y}`}
              className={className}
              disabled={disabled}
              onClick={() => onCellClick?.(cell)}
              title={`${x}:${y}`}
            >
              {shot ? shotLabel(shot.result) : hasShip ? "■" : ""}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function shotLabel(result: ShotRecord["result"]): string {
  if (result === "miss") return "•";
  if (result === "hit") return "×";
  return "✖";
}
