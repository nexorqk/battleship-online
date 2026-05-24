import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import type { Cell, PlayerGameView } from "@battleship/game-core";
import type { ClientToServerEvents, ServerToClientEvents } from "@battleship/shared";
import { joinGame } from "../api";
import { SOCKET_URL } from "../config";
import { Board } from "../components/Board";
import { createAutoFleet } from "../fixtures";
import { getStoredPlayer, storePlayer, type StoredPlayer } from "../storage";

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
    });

    socket.on("move:rejected", ({ reason }) => {
      pushNotif(reason, "error");
    });

    socket.on("shot:result", ({ target, result, nextTurn }) => {
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
      pushNotif(won ? "Victory! You sank the entire enemy fleet!" : "Defeat — your fleet was destroyed.", "success");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [gameId, player, pushNotif]);

  const handlePlaceShips = useCallback(() => {
    if (!gameId || !player) return;
    socketRef.current?.emit("ships:place", {
      gameId,
      playerToken: player.playerToken,
      ships: createAutoFleet(player.role === "playerA" ? 0 : 1),
    });
  }, [gameId, player]);

  const handleReady = useCallback(() => {
    if (!gameId || !player) return;
    socketRef.current?.emit("player:ready", {
      gameId,
      playerToken: player.playerToken,
    });
  }, [gameId, player]);

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

  // Render helpers
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
              Role: <strong>{player.role === "playerA" ? "Player 1" : "Player 2"}</strong>
            </span>
            <span
              className={`topbar-tag ${isFinished ? "winner-tag" : isMyTurn ? "turn-tag" : ""}`}
            >
              {isFinished ? (
                <>
                  Winner:{" "}
                  <strong>{view.winner === player.role ? "YOU" : "OPPONENT"}</strong>
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
              <button className="btn-action" onClick={handlePlaceShips}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
                Auto-place
              </button>
              <button className="btn-action primary-action" onClick={handleReady}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Ready
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
              Place your fleet and press <strong>Ready</strong>
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
            <p key={n.id} className={`notif notif-${n.kind}`} onClick={() => dismissNotif(n.id)}>
              {n.text}
            </p>
          ))}
        </div>
      )}

      {/* Boards */}
      <div className="boards-wrapper">
        <Board
          title="My Fleet"
          ships={view.myBoard.ships}
          shots={view.myBoard.shotsReceived}
          disabled
          isEnemy={false}
          myReady={view.myBoard.ready}
        />

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
