import React, { useEffect, useRef, useState } from "react";
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
  // Placement mode (only for own board during placing phase)
  placementMode?: boolean;
  previewCells?: Cell[];
  previewValid?: boolean;
  onCellHover?: (cell: Cell | null) => void;
  animationKey?: number;
  activeTurn?: boolean;
};

export const COL_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
export const ROW_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

export function Board({
  title,
  ships = [],
  shots,
  disabled = false,
  isEnemy = false,
  myReady,
  enemyReady,
  onCellClick,
  placementMode = false,
  previewCells = [],
  previewValid = true,
  onCellHover,
  animationKey,
  activeTurn,
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

  const previewSet = new Set(previewCells.map((c) => `${c.x}:${c.y}`));

  function getCellState(x: number, y: number) {
    const key = `${x}:${y}`;
    const shot = shotMap.get(key);
    const hasShip = shipCellSet.has(key);
    const isPreview = previewSet.has(key);

    if (shot) {
      if (shot.result === "miss") return "miss";
      if (shot.result === "hit") return hasShip ? "ship-hit" : "hit";
      if (shot.result === "sunk") return "sunk";
    }

    if (hasShip) return "ship";
    if (isPreview) return previewValid ? "preview-valid" : "preview-invalid";
    return "empty";
  }

  function cellLabel(state: string): React.ReactNode {
    if (state === "miss")
      return (
        <svg width="8" height="8" viewBox="0 0 8 8">
          <circle cx="4" cy="4" r="3" fill="currentColor" opacity="0.5" />
        </svg>
      );
    if (state === "hit" || state === "ship-hit")
      return (
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    if (state === "sunk")
      return (
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path d="M2 2l10 10M12 2l-10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    return null;
  }

  // Splash animation tracking
  const prevKeyRef = useRef(animationKey);
  const prevLenRef = useRef(shots.length);
  const [splashCells, setSplashCells] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (animationKey === undefined) return;
    if (animationKey === prevKeyRef.current) return;

    prevKeyRef.current = animationKey;

    const newCount = shots.length - prevLenRef.current;
    prevLenRef.current = shots.length;

    if (newCount <= 0) return;

    const newShots = shots.slice(-newCount);
    const next = new Map<string, number>();
    newShots.forEach((shot, i) => {
      next.set(`${shot.target.x}:${shot.target.y}`, i);
    });
    setSplashCells(next);

    const maxDelay = newShots.length * 50;
    const timer = setTimeout(() => {
      setSplashCells(new Map());
    }, 600 + maxDelay);

    return () => clearTimeout(timer);
  }, [animationKey, shots]);

  return (
    <section className={`board-section ${isEnemy ? "enemy-board" : "my-board"} ${activeTurn && isEnemy ? "active-turn" : ""}`}>
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
              const cellKey = `${x}:${y}`;
              const splashIndex = splashCells.get(cellKey);
              const hasSplash = splashIndex !== undefined;

              // In placement mode, own board cells are clickable if empty or already a ship
              const isInPlacementMode = placementMode && !isEnemy;
              // During gameplay, only enemy empty cells when it's your turn
              const isCombatClickable = isEnemy && !disabled && state === "empty";

              const isClickable = isInPlacementMode || isCombatClickable;

              const classNames = [
                "cell",
                state !== "empty" ? state : "",
                state === "ship" && !isEnemy ? "self" : "",
                hasSplash ? "splash" : "",
                isClickable ? "clickable" : "disabled",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={cellKey}
                  className={classNames}
                  disabled={!isClickable}
                  onClick={() => onCellClick?.({ x, y })}
                  onMouseEnter={() => onCellHover?.({ x, y })}
                  onMouseLeave={() => {
                    // Only clear hover if we're in placement mode (leave tracking)
                    if (placementMode) onCellHover?.(null);
                  }}
                  style={
                    hasSplash
                      ? ({ "--delay": `${splashIndex * 0.05}s` } as React.CSSProperties)
                      : undefined
                  }
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
