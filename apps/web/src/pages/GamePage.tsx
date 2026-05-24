import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { DEFAULT_FLEET, type Cell, type PlayerGameView, type Ship } from "@battleship/game-core";
import type { ClientToServerEvents, ServerToClientEvents } from "@battleship/shared";
import { joinGame } from "../api";
import { SOCKET_URL, TURN_TIMER_SECONDS } from "../config";
import { Board, COL_LABELS, ROW_LABELS } from "../components/Board";
import { GameOverOverlay } from "../components/GameOverOverlay";
import { ShipStatusBadge } from "../components/ShipStatusBadge";
import { TurnIndicator } from "../components/TurnIndicator";
import { createAutoFleet } from "../fixtures";
import { getStoredPlayer, storePlayer, type StoredPlayer } from "../storage";
import {
  type Direction,
  type PlacementShip,
  createFleetRoster,
  getPreviewCells,
  getShipCells,
  isValidPlacement,
  oppositeDirection,
} from "../placement";

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

type Notification = {
  id: number;
  text: string;
  kind: "info" | "error" | "success";
};

let notifId = 0;

// ===== Main Game Page =====

export function GamePage() {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const [player, setPlayer] = useState<StoredPlayer | null>(() =>
    gameId ? getStoredPlayer(gameId) : null,
  );
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinRetry, setJoinRetry] = useState(0);
  const [view, setView] = useState<(PlayerGameView & { version: number }) | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [copied, setCopied] = useState(false);
  const socketRef = useRef<GameSocket | null>(null);

  // Placement state
  const [roster, setRoster] = useState<PlacementShip[]>(createFleetRoster());
  const [selectedShipIdx, setSelectedShipIdx] = useState<number | null>(null);
  const [direction, setDirection] = useState<Direction>("horizontal");
  const [hoverCell, setHoverCell] = useState<Cell | null>(null);
  const [placedShips, setPlacedShips] = useState<Ship[]>([]);
  const [pendingReady, setPendingReady] = useState(false);

  // Turn timer state
  const [timeLeft, setTimeLeft] = useState<number | null>(TURN_TIMER_SECONDS);
  const turnRef = useRef<string | null>(null);
  const turnStartRef = useRef(Date.now());

  // Shot splash animation keys
  const [enemyShotKey, setEnemyShotKey] = useState(0);
  const [myShotKey, setMyShotKey] = useState(0);
  const prevEnemyShotsLen = useRef(0);
  const prevMyShotsLen = useRef(0);

  const inviteUrl = useMemo(() => window.location.href, []);

  const pushNotif = useCallback((text: string, kind: Notification["kind"] = "info") => {
    const id = ++notifId;
    setNotifications((prev) => [...prev.slice(-4), { id, text, kind }]);
    if (kind !== "error") {
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 4000);
    }
  }, []);

  const dismissNotif = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Join game via REST if not already a player
  useEffect(() => {
    if (!gameId || player) return;

    let cancelled = false;

    setJoinError(null);

    joinGame(gameId)
      .then((joined) => {
        if (cancelled) return;
        const nextPlayer = {
          playerToken: joined.playerToken,
          role: joined.role,
        };
        storePlayer(gameId, nextPlayer);
        setPlayer(nextPlayer);
      })
      .catch((reason) => {
        if (cancelled) return;
        const message =
          reason instanceof Error ? reason.message : "Failed to join game";
        setJoinError(message);
      });

    return () => {
      cancelled = true;
    };
  }, [gameId, player, joinRetry]);

  // Socket.IO connection
  useEffect(() => {
    if (!gameId || !player) return;

    let reconnected = false;

    const socket: GameSocket = io(SOCKET_URL, {
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      if (reconnected) {
        pushNotif("Reconnected to game", "info");
      }
      reconnected = true;

      socket.emit("game:join", {
        gameId,
        playerToken: player.playerToken,
      });
    });

    socket.on("game:view", (payload) => {
      setView(payload);
      if (pendingReady) {
        setPendingReady(false);
        socket.emit("player:ready", {
          gameId,
          playerToken: player.playerToken,
        });
      }
    });

    socket.on("move:rejected", ({ reason }) => {
      setPendingReady(false);
      pushNotif(reason, "error");
    });

    socket.on("shot:result", ({ target, result }) => {
      const col = String.fromCharCode(65 + target.x);
      const row = target.y + 1;
      const labels: Record<string, string> = {
        miss: "Miss",
        hit: "Hit!",
        sunk: "Sunk!",
      };
      pushNotif(`${labels[result] ?? result} at ${col}${row}`, "info");
    });

    socket.on("game:finished", ({ winner }) => {
      const won = winner === player.role;
      pushNotif(
        won
          ? "Victory! You sank the entire enemy fleet!"
          : "Defeat — your fleet was destroyed.",
        "success",
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [gameId, player, pushNotif, pendingReady]);

  // Increment shot animation keys when new shots arrive
  useEffect(() => {
    if (!view) return;
    if (view.enemyBoard.myShots.length !== prevEnemyShotsLen.current) {
      prevEnemyShotsLen.current = view.enemyBoard.myShots.length;
      setEnemyShotKey((k) => k + 1);
    }
    if (view.myBoard.shotsReceived.length !== prevMyShotsLen.current) {
      prevMyShotsLen.current = view.myBoard.shotsReceived.length;
      setMyShotKey((k) => k + 1);
    }
  }, [view?.enemyBoard.myShots.length, view?.myBoard.shotsReceived.length]);

  // Reset placement state when entering placing phase from server state
  useEffect(() => {
    if (view?.phase === "placing" && view.myBoard.ships.length > 0) {
      setPlacedShips(view.myBoard.ships);
      const localRoster = createFleetRoster();
      const shipLengthsOnBoard = view.myBoard.ships.map((s) => s.cells.length);
      for (const item of localRoster) {
        const idx = shipLengthsOnBoard.indexOf(item.length);
        if (idx !== -1) {
          shipLengthsOnBoard.splice(idx, 1);
          item.placed = true;
        }
      }
      setRoster(localRoster);
    } else if (
      view?.phase === "placing" &&
      view.myBoard.ships.length === 0 &&
      placedShips.length === 0
    ) {
      setPlacedShips([]);
      setRoster(createFleetRoster());
      setSelectedShipIdx(null);
      setHoverCell(null);
    }
  }, [view?.phase, view?.myBoard.ships, placedShips.length]);

  // ---- Turn timer ----
  useEffect(() => {
    if (!view || view.phase !== "active" || TURN_TIMER_SECONDS === null) {
      setTimeLeft(TURN_TIMER_SECONDS);
      return;
    }

    // Reset timer on every game state change during active phase
    // (shot result, turn change, etc.)
    turnStartRef.current = Date.now();
    setTimeLeft(TURN_TIMER_SECONDS);
  }, [view?.currentTurn, view?.phase, view?.version]);

  useEffect(() => {
    if (!view || view.phase !== "active" || TURN_TIMER_SECONDS === null) return;
    const timeoutSec = TURN_TIMER_SECONDS;

    const calcRemaining = () => {
      const elapsed = Math.floor((Date.now() - turnStartRef.current) / 1000);
      return Math.max(0, timeoutSec - elapsed);
    };

    // Sync tick immediately in case the interval fires after the turn already lapsed
    setTimeLeft(calcRemaining());

    const interval = setInterval(() => {
      setTimeLeft(calcRemaining());
    }, 1000);

    return () => clearInterval(interval);
  }, [view?.currentTurn, view?.phase, view?.version]);

  // ---- Derived computed stats ----
  const enemyShipsSunk = useMemo(() => {
    if (!view) return 0;
    // Each "sunk" result in my shots = one enemy ship destroyed
    const sunkShots = view.enemyBoard.myShots.filter((s) => s.result === "sunk");
    // A ship can have multiple sunk records if multiple shots register sunk
    // Actually, each ship is sunk exactly once. The sunk result appears once per ship.
    return sunkShots.length;
  }, [view?.enemyBoard.myShots]);

  const myShipsRemaining = useMemo(() => {
    if (!view) return 0;
    return view.myBoard.ships.filter((s) => !s.sunk).length;
  }, [view?.myBoard.ships]);

  const totalShips = DEFAULT_FLEET.length; // 10

  // ---- Handlers ----

  const handleSelectShip = useCallback((idx: number) => {
    setSelectedShipIdx((prev) => (prev === idx ? null : idx));
    setHoverCell(null);
  }, []);

  const handleRotate = useCallback(() => {
    setDirection((d) => oppositeDirection(d));
  }, []);

  const handleBoardClick = useCallback(
    (cell: Cell) => {
      if (selectedShipIdx === null) return;
      const rosterItem = roster[selectedShipIdx];
      if (!rosterItem || rosterItem.placed) return;

      const cells = getShipCells(cell, rosterItem.length, direction);
      if (!isValidPlacement(cells, placedShips)) return;

      const newShip: Ship = {
        id: rosterItem.id,
        cells,
        hits: [],
        sunk: false,
      };

      const nextPlaced = [...placedShips, newShip];
      setPlacedShips(nextPlaced);

      const nextRoster = roster.map((s, i) =>
        i === selectedShipIdx ? { ...s, placed: true } : s,
      );
      setRoster(nextRoster);

      if (nextRoster.every((s) => s.placed)) {
        setSelectedShipIdx(null);
      } else {
        const nextUnplaced = nextRoster.findIndex((s) => !s.placed);
        setSelectedShipIdx(nextUnplaced);
      }
      setHoverCell(null);
    },
    [selectedShipIdx, roster, direction, placedShips],
  );

  const handleCellHover = useCallback((cell: Cell | null) => {
    setHoverCell(cell);
  }, []);

  const handleAutoPlace = useCallback(() => {
    const fleet = createAutoFleet(player?.role === "playerA" ? 0 : 1);
    setPlacedShips(fleet);
    setRoster(createFleetRoster().map((s) => ({ ...s, placed: true })));
    setSelectedShipIdx(null);
    setHoverCell(null);
  }, [player]);

  const handleSubmitFleet = useCallback(() => {
    if (!gameId || !player || placedShips.length === 0) {
      pushNotif("Place at least one ship first", "error");
      return;
    }
    const allPlaced = roster.every((s) => s.placed);
    if (!allPlaced) {
      pushNotif("Place all ships before marking ready", "error");
      return;
    }
    setPendingReady(true);
    socketRef.current?.emit("ships:place", {
      gameId,
      playerToken: player.playerToken,
      ships: placedShips,
    });
  }, [gameId, player, placedShips, roster, pushNotif]);

  const handleShoot = useCallback(
    (target: Cell) => {
      if (!gameId || !player || !view) return;
      socketRef.current?.emit("shot:submit", {
        gameId,
        playerToken: player.playerToken,
        target,
        expectedVersion: view.version,
      });
    },
    [gameId, player, view],
  );

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [inviteUrl]);

  const handleNewGame = useCallback(() => {
    navigate("/");
  }, [navigate]);

  // Derive display state
  const canShoot = Boolean(
    view &&
      player &&
      view.phase === "active" &&
      view.currentTurn === player.role,
  );

  const isMyTurn = view?.currentTurn === player?.role;
  const isFinished = view?.phase === "finished";
  const isPlacing = view?.phase === "placing";
  const isWaiting = view?.phase === "waiting";

  // Compute preview cells for placement
  const previewCells = useMemo<Cell[]>(() => {
    if (
      selectedShipIdx === null ||
      !hoverCell ||
      !roster[selectedShipIdx] ||
      roster[selectedShipIdx]!.placed
    ) {
      return [];
    }
    return getPreviewCells(
      hoverCell,
      roster[selectedShipIdx]!.length,
      direction,
      placedShips,
    );
  }, [selectedShipIdx, hoverCell, roster, direction, placedShips]);

  const previewValid = previewCells.length > 0;

  // --- Render ---
  if (!gameId) {
    return (
      <main className="game-page">
        <div className="loading-state">
          <div className="loading-spinner" />
          <p className="loading-text">Invalid game link</p>
          <button className="btn-action" style={{ marginTop: 16 }} onClick={() => navigate("/")}>
            Create New Game
          </button>
        </div>
      </main>
    );
  }

  if (!player) {
    return (
      <main className="game-page">
        <div className="loading-state">
          {joinError ? (
            <>
              <p className="loading-text loading-error">{joinError}</p>
              <div className="loading-actions">
                <button
                  className="btn-action"
                  onClick={() => {
                    setJoinError(null);
                    setJoinRetry((c) => c + 1);
                  }}
                >
                  Try Again
                </button>
                <button className="btn-action primary-action" onClick={() => navigate("/")}>
                  Create New Game
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="loading-spinner" />
              <p className="loading-text">Joining game&hellip;</p>
            </>
          )}
        </div>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="game-page">
        <div className="loading-state">
          <div aria-hidden="true" className="loading-skeleton-wrapper">
            <div className="loading-skeleton-topbar" />
            <div className="boards-wrapper loading-skeleton">
              <div className="board-section">
                <div className="board-grid skeleton-grid">
                  <div className="coord-label corner" />
                  {COL_LABELS.map((label) => (
                    <div key={label} className="coord-label col-label">
                      {label}
                    </div>
                  ))}
                  {ROW_LABELS.map((rowLabel, y) => (
                    <Fragment key={y}>
                      <div className="coord-label row-label">{rowLabel}</div>
                      {COL_LABELS.map((_, x) => (
                        <div key={x} className="skeleton-cell" />
                      ))}
                    </Fragment>
                  ))}
                </div>
              </div>
              <div className="board-section">
                <div className="board-grid skeleton-grid">
                  <div className="coord-label corner" />
                  {COL_LABELS.map((label) => (
                    <div key={label} className="coord-label col-label">
                      {label}
                    </div>
                  ))}
                  {ROW_LABELS.map((rowLabel, y) => (
                    <Fragment key={y}>
                      <div className="coord-label row-label">{rowLabel}</div>
                      {COL_LABELS.map((_, x) => (
                        <div key={x} className="skeleton-cell" />
                      ))}
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <p className="loading-text">Loading game state&hellip;</p>
        </div>
      </main>
    );
  }

  return (
    <main className="game-page">
      {/* Top bar */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="topbar-logo">
            BS<span>O</span>
          </div>
          <div className="topbar-info">
            <span className="topbar-tag">
              Game: <strong>{gameId.slice(0, 8)}&hellip;</strong>
            </span>
            <span className="topbar-tag">
              Role:{" "}
              <strong>
                {player.role === "playerA" ? "Player 1" : "Player 2"}
              </strong>
            </span>
            <span
              className={`topbar-tag ${isFinished ? "winner-tag" : isMyTurn ? "turn-tag" : ""}`}
            >
              {isFinished ? (
                <>
                  Winner:{" "}
                  <strong>
                    {view.winner === player.role ? "YOU" : "OPPONENT"}
                  </strong>
                </>
              ) : isWaiting ? (
                <>
                  Status: <strong>WAITING</strong>
                </>
              ) : isPlacing ? (
                <>
                  Status: <strong>PLACING</strong>
                </>
              ) : (
                <>
                  Turn: <strong>{isMyTurn ? "YOU" : "OPPONENT"}</strong>
                </>
              )}
            </span>
            <span className="topbar-version">v{view.version}</span>
          </div>
        </div>
        <div className="topbar-actions">
          {isPlacing && (
            <>
              <button className="btn-action" onClick={handleAutoPlace}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
                Auto-place
              </button>
              <button
                className="btn-action primary-action"
                onClick={handleSubmitFleet}
                disabled={!roster.every((s) => s.placed) || pendingReady}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {pendingReady ? "Placing..." : "Ready"}
              </button>
            </>
          )}
          <button className="btn-action" onClick={handleCopyLink}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            {copied ? "Copied!" : "Copy invite"}
          </button>
        </div>
      </header>

      {/* Turn / status indicator */}
      <TurnIndicator
        view={view}
        player={player}
        isMyTurn={isMyTurn}
        isFinished={isFinished}
        placedShipsCount={placedShips.length}
        timeLeft={timeLeft}
        turnTimeoutSec={TURN_TIMER_SECONDS}
      />

      {/* Notification toasts */}
      {notifications.length > 0 && (
        <div className="notif-stack">
          {notifications.map((n) => (
            <p
              key={n.id}
              className={`notif notif-${n.kind}`}
              onClick={() => dismissNotif(n.id)}
            >
              {n.text}
            </p>
          ))}
        </div>
      )}

      {/* Boards */}
      <div className="boards-wrapper">
        <div className="board-column">
          <Board
            title="My Fleet"
            ships={placedShips}
            shots={view.myBoard.shotsReceived}
            disabled={!isPlacing}
            isEnemy={false}
            myReady={view.myBoard.ready}
            placementMode={isPlacing}
            previewCells={previewCells}
            previewValid={previewValid}
            onCellHover={handleCellHover}
            onCellClick={handleBoardClick}
            animationKey={myShotKey}
          />

          {/* Ship palette — only during placing phase */}
          {isPlacing && (
            <div className="fleet-palette">
              <div className="palette-header">
                <span className="palette-title">Your Fleet</span>
                <button
                  className="palette-rotate"
                  onClick={handleRotate}
                  title={`Direction: ${direction}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                  Rotate
                </button>
              </div>
              <div className="palette-ships">
                {roster.map((ship, idx) => (
                  <button
                    key={ship.id}
                    className={`palette-ship ${ship.placed ? "placed" : ""} ${selectedShipIdx === idx ? "selected" : ""}`}
                    onClick={() => handleSelectShip(idx)}
                    disabled={ship.placed}
                  >
                    <span className="palette-ship-length">{ship.length}</span>
                    <span className="palette-ship-bar">
                      {Array.from({ length: ship.length }).map((_, i) => (
                        <span key={i} className="palette-ship-cell" />
                      ))}
                    </span>
                    {ship.placed && <span className="palette-ship-check">✓</span>}
                  </button>
                ))}
              </div>
              <div className="palette-footer">
                <span className="palette-count">
                  {placedShips.length} / {roster.length} placed
                </span>
                {placedShips.length > 0 && (
                  <button
                    className="palette-clear"
                    onClick={() => {
                      setPlacedShips([]);
                      setRoster(createFleetRoster());
                      setSelectedShipIdx(null);
                      setHoverCell(null);
                    }}
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="board-column">
          <Board
            title="Enemy Waters"
            shots={view.enemyBoard.myShots}
            disabled={!canShoot}
            isEnemy
            activeTurn={canShoot}
            enemyReady={view.enemyBoard.enemyReady}
            onCellClick={handleShoot}
            animationKey={enemyShotKey}
          />

          {/* Ship status — during active/completed phase */}
          {(view.phase === "active" || isFinished) && (
            <ShipStatusBadge sunk={enemyShipsSunk} total={totalShips} />
          )}
        </div>
      </div>

      {/* Game Over Overlay */}
      {isFinished && (
        <GameOverOverlay
          won={view.winner === player.role}
          myShipsRemaining={myShipsRemaining}
          totalMyShips={totalShips}
          enemyShipsSunk={enemyShipsSunk}
          totalEnemyShips={totalShips}
          onNewGame={handleNewGame}
        />
      )}
    </main>
  );
}
