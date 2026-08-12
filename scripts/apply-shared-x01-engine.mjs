import fs from "node:fs";

function replaceOnce(source, pattern, replacement, label) {
  const updated = source.replace(pattern, replacement);
  if (updated === source) throw new Error(`Patch failed: ${label}`);
  return updated;
}

// Local total-score scoring now delegates X01 outcome rules to the shared engine.
{
  const path = "lib/scoring.ts";
  let source = fs.readFileSync(path, "utf8");
  if (!source.includes('from "./x01Engine"')) {
    source = `import { evaluateX01Turn } from "./x01Engine";\n\n${source}`;
  }

  const scoreTurnPattern = /export function scoreTurn\([\s\S]*?\n}\nconst checkoutSuggestions/;
  const replacement = `export function scoreTurn(
    player: Player,
    scoreEntered: number,
    finishRule: FinishRule
): ScoreResult {
    const evaluation = evaluateX01Turn({
        scoreBefore: player.score,
        scoreEntered,
        finishRule,
    });

    const turn: Turn = {
        id: createTurnId(),
        playerId: player.id,
        playerName: player.name,
        scoreEntered,
        scoreBefore: player.score,
        scoreAfter: evaluation.scoreAfter,
        dartsThrown: 3,
        isBust: evaluation.isBust,
        isCheckout: evaluation.isCheckout,
        finishRule,
    };

    const updatedPlayer: Player = {
        ...player,
        score: evaluation.scoreAfter,
    };

    if (evaluation.isBust) {
        return {
            turn,
            updatedPlayer,
            isLegComplete: false,
            needsDoubleOutConfirmation: false,
            message: \`${'${player.name}'} busts!\`,
        };
    }

    if (evaluation.needsDoubleOutConfirmation) {
        return {
            turn,
            updatedPlayer,
            isLegComplete: false,
            needsDoubleOutConfirmation: true,
            message: \`${'${player.name}'} reached zero. Was the final dart a double?\`,
        };
    }

    if (evaluation.isCheckout) {
        return {
            turn,
            updatedPlayer,
            isLegComplete: true,
            needsDoubleOutConfirmation: false,
            message: \`${'${player.name}'} wins the leg!\`,
        };
    }

    return {
        turn,
        updatedPlayer,
        isLegComplete: false,
        needsDoubleOutConfirmation: false,
        message: \`${'${player.name}'} scored ${'${scoreEntered}'}.\`,
    };
}
const checkoutSuggestions`;
  source = replaceOnce(source, scoreTurnPattern, replacement, "local scoreTurn delegation");
  fs.writeFileSync(path, source);
}

// The graphical UI preview uses the same outcome evaluator as persisted scoring.
{
  const path = "components/DartEntry.tsx";
  let source = fs.readFileSync(path, "utf8");
  if (!source.includes('@/lib/x01Engine')) {
    source = source.replace(
      'import { getDartLabel } from "@/lib/darts";',
      'import { getDartLabel } from "@/lib/darts";\nimport { evaluateX01Turn } from "@/lib/x01Engine";',
    );
  }

  source = source.replace(
    /function isDoubleOutDart\([\s\S]*?\n}\n\nfunction getPreviewToneClass/,
    "function getPreviewToneClass",
  );

  const previewPattern = /function getTurnPreview\([\s\S]*?\n}\n\nconst boardTargets/;
  const previewReplacement = `function getTurnPreview(
  currentScore: number,
  turnTotal: number,
  darts: DartThrow[],
  finishRule: FinishRule,
): TurnPreview {
  if (darts.length === 0) {
    const checkout = getCheckoutSuggestion(currentScore);
    return {
      label: \`${'${currentScore}'} remaining\`,
      detail: checkout ? \`Checkout: ${'${checkout}'}\` : "Tap the board to build this turn.",
      tone: "neutral",
    };
  }

  const evaluation = evaluateX01Turn({
    scoreBefore: currentScore,
    scoreEntered: turnTotal,
    finishRule,
    dartsThrown: darts.length as 1 | 2 | 3,
    darts,
  });

  if (evaluation.isBust) {
    const reachedZero = currentScore - turnTotal === 0;
    return {
      label: reachedZero ? "Invalid checkout" : "Bust if submitted",
      detail: reachedZero
        ? "Final dart must be a double or bull."
        : \`${'${turnTotal}'} scored from ${'${currentScore}'}.\`,
      tone: "danger",
    };
  }

  if (evaluation.isCheckout) {
    return {
      label: "Checkout ready",
      detail: \`Submit to finish the leg in ${'${darts.length}'} dart${'${darts.length === 1 ? "" : "s"}'}.\`,
      tone: "good",
    };
  }

  const checkout = getCheckoutSuggestion(evaluation.scoreAfter);
  return {
    label: \`${'${evaluation.scoreAfter}'} remaining\`,
    detail: checkout ? \`Next checkout: ${'${checkout}'}\` : \`${'${turnTotal}'} this turn.\`,
    tone: checkout ? "good" : "neutral",
  };
}

const boardTargets`;
  source = replaceOnce(source, previewPattern, previewReplacement, "graphical preview delegation");
  fs.writeFileSync(path, source);
}

// Central league/device scoring now uses the same X01 turn evaluator.
{
  const path = "lib/db/repositories/leagueMatches.ts";
  let source = fs.readFileSync(path, "utf8");
  if (!source.includes('@/lib/x01Engine')) {
    source = source.replace(
      'import { getDatabase } from "../client";',
      'import { evaluateX01Turn, X01RuleError } from "@/lib/x01Engine";\nimport { getDatabase } from "../client";',
    );
  }

  source = replaceOnce(
    source,
    /function validGraphicalDart\([\s\S]*?\n}\n\nfunction parseStoredDartSegment/,
    "function parseStoredDartSegment",
    "remove duplicated graphical rule helpers",
  );

  // Remove the old independent graphical validation call if present.
  source = source.replace(/\n\s*validateGraphicalDarts\(input\.darts, input\.scoreEntered, input\.dartsThrown\);/g, "");

  const outcomePattern = /  const scoreBefore = state\.currentTeamId === teamA\.id \? state\.teamAScore : state\.teamBScore;[\s\S]*?  const turnIndex = turns\.length \? Math\.max\(\.\.\.turns\.map\(\(turn\) => turn\.turnIndex\)\) \+ 1 : 1;/;
  const outcomeReplacement = `  const scoreBefore = state.currentTeamId === teamA.id ? state.teamAScore : state.teamBScore;
  let evaluation;
  try {
    evaluation = evaluateX01Turn({
      scoreBefore,
      scoreEntered: input.scoreEntered,
      finishRule: context.session.finishRule === "double" ? "double_out" : "straight_out",
      dartsThrown: input.dartsThrown,
      darts: input.darts,
      // Device/browser total entry must provide positive checkout evidence.
      // Undefined therefore means "not confirmed" on the authoritative server.
      checkoutConfirmed: input.darts === undefined ? input.checkoutConfirmed === true : undefined,
    });
  } catch (error) {
    if (error instanceof X01RuleError) throw new LeagueMatchStateError(error.message);
    throw error;
  }
  const { scoreAfter, isBust, isCheckout } = evaluation;
  const turnIndex = turns.length ? Math.max(...turns.map((turn) => turn.turnIndex)) + 1 : 1;`;
  source = replaceOnce(source, outcomePattern, outcomeReplacement, "central X01 outcome delegation");

  // Persist whether a double-out checkout was actually accepted by the engine.
  source = source.replace(
    /checkoutConfirmed:\s*(?:exactCheckoutConfirmed|input\.checkoutConfirmed === true),/g,
    'checkoutConfirmed: isCheckout && context.session.finishRule === "double",',
  );

  // Any leftover exact-checkout declaration belonged to the removed rule block.
  source = source.replace(/\n\s*const exactCheckoutConfirmed =[^;]+;/g, "");
  fs.writeFileSync(path, source);
}
