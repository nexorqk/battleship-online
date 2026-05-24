import z from "zod";
import { BOARD_SIZE } from "@battleship/game-core";

const gameIdSchema = z.string().trim().min(1, "gameId is required");
const playerTokenSchema = z.string().trim().min(1, "playerToken is required");

const cellSchema = z
  .object({
    x: z.number().int().min(0).max(BOARD_SIZE - 1),
    y: z.number().int().min(0).max(BOARD_SIZE - 1),
  })
  .strict();

const shipSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    cells: z.array(cellSchema).min(1).max(BOARD_SIZE),
    hits: z.array(cellSchema).default([]),
    sunk: z.boolean().default(false),
  })
  .strict();

export const socketPayloadSchemas = {
  gameJoin: z
    .object({
      gameId: gameIdSchema,
      playerToken: playerTokenSchema,
    })
    .strict(),

  shipsPlace: z
    .object({
      gameId: gameIdSchema,
      playerToken: playerTokenSchema,
      ships: z.array(shipSchema).min(1).max(10),
    })
    .strict(),

  playerReady: z
    .object({
      gameId: gameIdSchema,
      playerToken: playerTokenSchema,
    })
    .strict(),

  shotSubmit: z
    .object({
      gameId: gameIdSchema,
      playerToken: playerTokenSchema,
      target: cellSchema,
      expectedVersion: z.number().int().min(0),
    })
    .strict(),
};

export type SocketPayloadName = keyof typeof socketPayloadSchemas;
export type ParsedSocketPayloads = {
  [Name in SocketPayloadName]: z.infer<(typeof socketPayloadSchemas)[Name]>;
};

export function parseSocketPayload<Name extends SocketPayloadName>(
  name: Name,
  payload: unknown,
): ParsedSocketPayloads[Name] {
  return socketPayloadSchemas[name].parse(payload) as ParsedSocketPayloads[Name];
}

export function validationErrorMessage(error: unknown): string {
  if (!(error instanceof z.ZodError)) {
    return error instanceof Error ? error.message : "UNKNOWN_ERROR";
  }

  const firstIssue = error.issues[0];
  if (!firstIssue) return "INVALID_PAYLOAD";

  const path = firstIssue.path.join(".");
  return path ? `INVALID_PAYLOAD: ${path}: ${firstIssue.message}` : `INVALID_PAYLOAD: ${firstIssue.message}`;
}
