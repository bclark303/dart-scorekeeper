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
