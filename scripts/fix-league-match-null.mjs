import fs from "node:fs";

const path = "lib/db/repositories/leagueMatches.ts";
let source = fs.readFileSync(path, "utf8");
source = source.replace(
  'import { and, asc, desc, eq } from "drizzle-orm";',
  'import { and, asc, desc, eq, isNull } from "drizzle-orm";',
);
source = source.replace(
  '        eq(leagueMatchTurns.voidedAt, null),',
  '        isNull(leagueMatchTurns.voidedAt),',
);
fs.writeFileSync(path, source);
