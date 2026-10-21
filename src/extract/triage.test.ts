import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import type { PageData } from "./pageData";
import { triagePage, type ChartForm } from "./triage";
import { mismatches, type TriageFixture } from "./triageFixture";

// Runs against locally preprocessed sample patterns (data/raw is gitignored).
const RAW = "data/raw";
const page = (slug: string, n: number) =>
  triagePage(JSON.parse(fs.readFileSync(path.join(RAW, slug, "pages", `p${String(n).padStart(2, "0")}.json`), "utf8")) as PageData);
const forms = (slug: string, n: number) => page(slug, n).charts.map((c) => c.form).sort() as ChartForm[];

describe.skipIf(!fs.existsSync(RAW))("triage on sample patterns", () => {
  test("Tove: three filled-cell charts on the last page", () => {
    expect(forms("nb-tove-eng4", 7)).toEqual(["vector", "vector", "vector"]);
    for (const n of [1, 2, 3, 4, 5, 6]) expect(forms("nb-tove-eng4", n)).toEqual([]);
  });

  test("Lopi: vector charts; size-annotation text is not a symbol font", () => {
    expect(forms("lopi-gjof-eng", 3)).toEqual(["vector", "vector"]);
    expect(forms("lopi-gjof-eng", 4)).toEqual(["vector", "vector"]);
    expect(forms("lopi-gjof-eng", 2)).toEqual([]);
  });

  test("Lucky Stars: written colorwork found, 'k3' tokens are not glyphs", () => {
    for (const n of [4, 5, 6, 7, 8]) expect(forms("lucky-stars-beanie-v5", n)).toEqual(["writtenColor"]);
    // The size chart images sit beside the written rows.
    expect(page("lucky-stars-beanie-v5", 4).images.some((i) => i.coverage > 0.3)).toBe(true);
  });

  test("Wavelength charts: glyph charts kept from the LLM except the prose-heavy repeats page", () => {
    const pages = fs.readdirSync(path.join(RAW, "wavelengthcardigancharts", "pages")).filter((f) => f.endsWith(".json"));
    for (let n = 1; n <= pages.length; n++) {
      const p = page("wavelengthcardigancharts", n);
      expect(p.charts.length).toBeGreaterThan(0);
      expect(p.charts.every((c) => c.form === "font")).toBe(true);
      expect(p.sendToLlm).toBe(n === 17);
    }
    // One chart per chart: overlapping grid and glyph fragments are merged.
    expect(forms("wavelengthcardigancharts", 3)).toEqual(["font"]);
    expect(forms("wavelengthcardigancharts", 4)).toEqual(["font", "font"]);
  });

  test("full-page backgrounds behind prose are not content images", () => {
    expect(page("happy-street-slipover-english", 3).images).toEqual([]);
    expect(page("happy-street-slipover-english", 1).images.length).toBeGreaterThan(0); // cover
  });

  test("Moonbun schematic lettering is not a symbol font", () => {
    expect(forms("moonbun-jumper-by-saskieco", 10)).toEqual([]);
  });
});

// Every page reviewed in the inspector (fixtures/triage/<slug>.json) must still match.
const FIXTURES = "fixtures/triage";
const fixtureFiles = fs.existsSync(FIXTURES) ? fs.readdirSync(FIXTURES).filter((f) => f.endsWith(".json")) : [];

describe.skipIf(!fs.existsSync(RAW) || fixtureFiles.length === 0)("triage matches reviewed fixtures", () => {
  for (const file of fixtureFiles) {
    const slug = file.replace(/\.json$/, "");
    const fixture: TriageFixture = JSON.parse(fs.readFileSync(path.join(FIXTURES, file), "utf8"));
    test.each(Object.entries(fixture))(`${slug} p%s`, (n, expected) => {
      expect(mismatches(page(slug, Number(n)), expected)).toEqual([]);
    });
  }
});
