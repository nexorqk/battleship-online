import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import type { Cell, PlayerGameView, Ship } from "@battleship/game-core";
import type { ClientToServerEvents, ServerToClientEvents } from "@battleship/shared";
import { joinGame } from "../api";
import { SOCKET_URL } from "../config";
import { Board } from "../components/Board";
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

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [player, setPlayer] = useState<StoredPlayer | null>(() =>
    gameId ? getStoredPlayer(gameId) : null,
  );
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
        pushNotif(
          reason instanceof Error ? reason.message : "Failed to join game",
          "error",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [gameId, player, pushNotif]);

  // Socket.IO connection
  useEffect(() => {
    if (!gameId || !player) return;

    const socket: GameSocket = io(SOCKET_URL, {
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("game:join", {
        gameId,
        playerToken: player.playerToken,
      });
    });

    socket.on("game:view", (payload) => {
      setView(payload);
      // If we had a pending ready (ships were just placed), send ready now
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

  // Reset placement state when entering placing phase from server state
  useEffect(() => {
    if (view?.phase === "placing" && view.myBoard.ships.length > 0) {
      // Ships already placed on server (e.g., after refresh or opponent's update)
      // Sync local placedShips from the view
      setPlacedShips(view.myBoard.ships);
      // Mark ships as placed in roster based on what's on the board
      const localRoster = createFleetRoster();
      const remaining = [...view.myBoard.ships.map((s) => s.cells.length)];
      let rosterIdx = 0;
      for (const shipLen of localRoster.map((s) => s.length)) {
        const matchIdx = remaining.indexOf(shipLen);
        if (matchIdx !== -1) {
          remaining.splice(matchIdx, 1);
          localRoster[rosterIdx]!.placed = false; // already placed count via server
        }
        rosterIdx++;
      }
      // Simpler approach: just mark all ships that match as placed
      const shipLengthsOnBoard = view.myBoard.ships.map((s) => s.cells.length);
      for (const item of localRoster) {
        const idx = shipLengthsOnBoard.indexOf(item.length);
        if (idx !== -1) {
          shipLengthsOnBoard.splice(idx, 1);
          item.placed = true;
        }
      }
      setRoster(localRoster);
    } else if (view?.phase === "placing" && view.myBoard.ships.length === 0) {
      // Fresh placing phase — reset
      setPlacedShips([]);
      setRoster(createFleetRoster());
      setSelectedShipIdx(null);
      setHoverCell(null);
    }
  }, [view?.phase, view?.myBoard.ships]);

  // --- Placement handlers ---

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

      // Mark ship as placed in roster
      const nextRoster = roster.map((s, i) =>
        i === selectedShipIdx ? { ...s, placed: true } : s,
      );
      setRoster(nextRoster);

      // Auto-deselect if all ships placed
      if (nextRoster.every((s) => s.placed)) {
        setSelectedShipIdx(null);
      } else {
        // Move selection to next unplaced ship
        const nextUnplaced = nextRoster.findIndex((s) => !s.placed);
        setSelectedShipIdx(nextUnplaced);
      }
      setHoverCell(null);
    },
    [selectedShipIdx, roster, direction, placedShips],
  );

  const handleCellHover = useCallback(
    (cell: Cell | null) => {
      setHoverCell(cell);
    },
    [],
  );

  const handleRemoveShip = useCallback(
    (shipId: string) => {
      const shipToRemove = placedShips.find((s) => s.id === shipId);
      if (!shipToRemove) return;

      setPlacedShips((prev) => prev.filter((s) => s.id !== shipId));
      setRoster((prev) =>
        prev.map((s) =>
          s.id === shipId ? { ...s, placed: false } : s,
        ),
      );
    },
    [placedShips],
  );

  const handleAutoPlace = useCallback(() => {
    const fleet = createAutoFleet(player?.role === "playerA" ? 0 : 1);
    setPlacedShips(fleet);
    // Mark all as placed in roster
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
    // Emit ships and mark pending ready
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
        </div>
      </main>
    );
  }

  if (!player) {
    return (
      <main className="game-page">
        <div className="loading-state">
          <div className="loading-spinner" />
          <p className="loading-text">Joining game&hellip;</p>
        </div>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="game-page">
        <div className="loading-state">
          <div className="loading-spinner" />
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
                disabled={placedShips.length === 0}
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
            <>Waiting for opponent to join&hellip;</>
          ) : isPlacing ? (
            <>
              {placedShips.length === 0
                ? "Select a ship below, then click the board to place it"
                : placedShips.length < 10
                  ? `Place ${10 - placedShips.length} more ship${10 - placedShips.length > 1 ? "s" : ""}`
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
      </div>

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
                    {ship.placed && (
                      <span className="palette-ship-check">✓</span>
                    )}
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

        <Board
          title="Enemy Waters"
          shots={view.enemyBoard.myShots}
          disabled={!canShoot}
          isEnemy
          enemyReady={view.enemyBoard.enemyReady}
          onCellClick={handleShoot}
        />
      </div>
    </main>
  );
}
