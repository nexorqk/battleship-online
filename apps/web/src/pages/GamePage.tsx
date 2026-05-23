import { useEffect, useMemo, useRef, useState } from "react";
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

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [player, setPlayer] = useState<StoredPlayer | null>(() =>
    gameId ? getStoredPlayer(gameId) : null,
  );
  const [view, setView] = useState<(PlayerGameView & { version: number }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<GameSocket | null>(null);

  const inviteUrl = useMemo(() => window.location.href, []);

  useEffect(() => {
    if (!gameId || player) return;

    joinGame(gameId)
      .then((joined) => {
        const nextPlayer = {
          playerToken: joined.playerToken,
          role: joined.role,
        };
        storePlayer(gameId, nextPlayer);
        setPlayer(nextPlayer);
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Failed to join game");
      });
  }, [gameId, player]);

  useEffect(() => {
    if (!gameId || !player) return;

    const socket: GameSocket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("game:join", {
        gameId,
        playerToken: player.playerToken,
      });
    });

    socket.on("game:view", setView);
    socket.on("move:rejected", ({ reason }) => setError(reason));
    socket.on("shot:result", ({ result }) => setError(`Shot result: ${result}`));
    socket.on("game:finished", ({ winner }) => setError(`Game finished. Winner: ${winner}`));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [gameId, player]);

  function placeShips() {
    if (!gameId || !player) return;

    socketRef.current?.emit("ships:place", {
      gameId,
      playerToken: player.playerToken,
      ships: createAutoFleet(player.role === "playerA" ? 0 : 1),
    });
  }

  function markReady() {
    if (!gameId || !player) return;

    socketRef.current?.emit("player:ready", {
      gameId,
      playerToken: player.playerToken,
    });
  }

  function shoot(target: Cell) {
    if (!gameId || !player || !view) return;

    socketRef.current?.emit("shot:submit", {
      gameId,
      playerToken: player.playerToken,
      target,
      expectedVersion: view.version,
    });
  }

  const canShoot = Boolean(
    view &&
      player &&
      view.phase === "active" &&
      view.currentTurn === player.role &&
      !view.enemyBoard.myShots.some((shot) => shot.result && false),
  );

  if (!gameId) {
    return <main className="page">Missing game id.</main>;
  }

  if (!player) {
    return <main className="page">Joining game...</main>;
  }

  return (
    <main className="page game-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Game ID: {gameId}</p>
          <h1>Battleship Online</h1>
          <p>
            Role: <strong>{player.role}</strong>{" "}
            {view && (
              <>
                · Phase: <strong>{view.phase}</strong> · Turn:{" "}
                <strong>{view.currentTurn}</strong> · Version:{" "}
                <strong>{view.version}</strong>
              </>
            )}
          </p>
        </div>
        <div className="actions">
          <button onClick={() => navigator.clipboard.writeText(inviteUrl)}>Copy invite link</button>
          <button onClick={placeShips}>Auto-place ships</button>
          <button onClick={markReady}>Ready</button>
        </div>
      </header>

      {error && <p className="notice">{error}</p>}

      {!view ? (
        <p>Loading game...</p>
      ) : (
        <div className="boards">
          <Board
            title="My board"
            ships={view.myBoard.ships}
            shots={view.myBoard.shotsReceived}
            disabled
          />

          <Board
            title="Enemy board"
            shots={view.enemyBoard.myShots}
            disabled={!canShoot}
            onCellClick={shoot}
          />
        </div>
      )}
    </main>
  );
}
