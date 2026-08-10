export function createPortableId(prefix: string): string {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}-${randomPart}`;
}

/**
 * Browser-created match IDs remain stable across refreshes and can safely be
 * reused when a local-first match is retried/synchronized to the server.
 */
export function createMatchId(): string {
  return createPortableId("match");
}

export type MatchIdentity = {
  id: string;
  createdAt: number;
};

/**
 * Create the durable identity and its creation timestamp together outside the
 * React component. This keeps identity generation as a persistence concern and
 * avoids time/random generation in component render scope.
 */
export function createMatchIdentity(): MatchIdentity {
  return {
    id: createMatchId(),
    createdAt: Date.now(),
  };
}

/**
 * Current UI side/member IDs are intentionally simple and repeat each game.
 * Namespace them under the durable match ID before persistence so database IDs
 * are globally unique without forcing the scoring UI to change its local IDs.
 */
export function createMatchChildId(
  matchId: string,
  kind: "side" | "participant" | "leg" | "turn" | "dart",
  localId: string | number,
): string {
  return `${matchId}:${kind}:${localId}`;
}
