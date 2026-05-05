import { readFileSync } from "node:fs";
import { and, eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

function collectIso2FromCsv(): string[] {
  const text = readFileSync(
    new URL("../../../numbering_plan.csv", import.meta.url),
    "utf8",
  );
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const set = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!.split(",").map((c) => c.trim());
    if (cells.length < 2) continue;
    const iso2 = cells[1]!.toUpperCase();
    if (/^[A-Z]{2}$/.test(iso2)) set.add(iso2);
  }
  return [...set].sort();
}

export async function seedCountries(
  db: NodePgDatabase<typeof schema>,
): Promise<void> {
  const en = new Intl.DisplayNames(["en"], { type: "region" });
  const it = new Intl.DisplayNames(["it"], { type: "region" });

  const iso2List = collectIso2FromCsv();

  let inserted = 0;
  let skipped = 0;

  for (const iso2 of iso2List) {
    const nameEn = en.of(iso2);
    const nameIt = it.of(iso2);
    if (!nameEn || !nameIt || nameEn === iso2 || nameIt === iso2) {
      console.warn(`countries seed: no localized name for ${iso2}, skipping`);
      skipped += 1;
      continue;
    }

    const existing = await db
      .select()
      .from(schema.countries)
      .where(
        and(
          eq(schema.countries.iso2, iso2),
          isNull(schema.countries.deletedAt),
        ),
      )
      .limit(1);
    if (existing[0]) continue;

    await db.insert(schema.countries).values({ iso2, nameEn, nameIt });
    inserted += 1;
  }

  console.log(
    `seeded countries: ${inserted} inserted, ${skipped} skipped (no localized name)`,
  );
}
