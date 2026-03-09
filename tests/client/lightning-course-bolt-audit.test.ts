import { describe, expect, it, vi } from "vitest";
import path from "path";

vi.unmock("fs");
vi.unmock("node:fs");

import fs from "fs";

import {
  chapters,
  CHAPTER_REQUIREMENTS,
} from "../../client/src/pages/lightning-tutorial.tsx";
import { LIGHTNING_EXERCISES } from "../../client/src/data/lightning-exercises.ts";
import { TX_GENERATORS } from "../../client/src/data/tx-generators.ts";

const REPORT_PATH = path.resolve(__dirname, "../../test-results/lightning-course-bolt-audit.json");

type CourseBlock =
  | { type: "drag-drop"; id: string }
  | { type: "checkpoint"; id: string }
  | { type: "checkpoint-group"; id: string; questionIds: string[] }
  | { type: "exercises"; exerciseIds: string[] }
  | { type: "generator"; id: string };

interface AuditChapter {
  id: string;
  title: string;
  markdown: string | null;
  blocks: CourseBlock[];
  isReadOnly: boolean;
}

const BLOCK_RE =
  /<drag-drop\s+id="([^"]+)"[^>]*>|<checkpoint-group\s+id="([^"]+)"\s+ids="([^"]+)"[^>]*>|<checkpoint\s+id="([^"]+)"[^>]*>|<code-intro[^>]+exercises="([^"]+)"[^>]*>|<tx-generator\s+id="([^"]+)"[^>]*>/g;

function loadChapterMarkdown(file: string | undefined): string | null {
  if (!file) return null;
  const absPath = path.resolve(__dirname, "../../client/public", file.replace(/^\//, ""));
  return fs.existsSync(absPath) ? fs.readFileSync(absPath, "utf8") : null;
}

function extractBlocks(markdown: string): CourseBlock[] {
  const blocks: CourseBlock[] = [];
  let match: RegExpExecArray | null;

  while ((match = BLOCK_RE.exec(markdown)) !== null) {
    if (match[1]) {
      blocks.push({ type: "drag-drop", id: match[1] });
      continue;
    }
    if (match[2]) {
      blocks.push({
        type: "checkpoint-group",
        id: match[2],
        questionIds: match[3].split(",").map((id) => id.trim()).filter(Boolean),
      });
      continue;
    }
    if (match[4]) {
      blocks.push({ type: "checkpoint", id: match[4] });
      continue;
    }
    if (match[5]) {
      blocks.push({
        type: "exercises",
        exerciseIds: match[5].split(",").map((id) => id.trim()).filter(Boolean),
      });
      continue;
    }
    if (match[6]) {
      blocks.push({ type: "generator", id: match[6] });
    }
  }

  BLOCK_RE.lastIndex = 0;
  return blocks;
}

const auditChapters: AuditChapter[] = chapters.map((chapter) => {
  const markdown = loadChapterMarkdown(chapter.file);
  const reqs = CHAPTER_REQUIREMENTS[chapter.id];
  const isReadOnly = !!reqs &&
    reqs.checkpoints.length === 0 &&
    reqs.exercises.length === 0 &&
    chapter.id !== "quiz" &&
    chapter.id !== "pay-it-forward";

  return {
    id: chapter.id,
    title: chapter.title,
    markdown,
    blocks: markdown ? extractBlocks(markdown) : [],
    isReadOnly,
  };
});

function chapterMarkdown(chapterId: string): string {
  const chapter = auditChapters.find((entry) => entry.id === chapterId);
  if (!chapter?.markdown) {
    throw new Error(`Missing markdown for chapter ${chapterId}`);
  }
  return chapter.markdown;
}

describe("Lightning course BOLT audit", () => {
  it("keeps tracked generator prerequisites reachable earlier in the course", () => {
    const exerciseChapterIndex = new Map<string, number>();

    auditChapters.forEach((chapter, chapterIndex) => {
      for (const block of chapter.blocks) {
        if (block.type === "exercises") {
          for (const exerciseId of block.exerciseIds) {
            exerciseChapterIndex.set(exerciseId, chapterIndex);
          }
        }
      }
    });

    for (const [generatorId, config] of Object.entries(TX_GENERATORS)) {
      if (!config.requiredExercises?.length) continue;
      const generatorChapterIndex = auditChapters.findIndex((chapter) =>
        chapter.blocks.some((block) => block.type === "generator" && block.id === generatorId)
      );

      expect(generatorChapterIndex).toBeGreaterThanOrEqual(0);

      for (const exerciseId of config.requiredExercises) {
        expect(
          exerciseChapterIndex.get(exerciseId),
          `${generatorId} prerequisite ${exerciseId} must appear before or in the same chapter`
        ).toBeLessThanOrEqual(generatorChapterIndex);
      }
    }
  });

  it("preserves key BOLT-backed content claims in markdown", () => {
    const commitmentSecrets = chapterMarkdown("commitment-secrets");
    expect(commitmentSecrets).toContain("per_commitment_index = 281474976710655 - commitment_number");
    expect(commitmentSecrets).toContain("descending index");

    const obscuredCommitment = chapterMarkdown("obscured-commitment");
    expect(obscuredCommitment).toContain("lower 24 bits are placed in the **locktime** field");
    expect(obscuredCommitment).toContain("upper 24 bits are placed in the **sequence** field");

    const commitmentScripts = chapterMarkdown("commitment-scripts");
    expect(commitmentScripts).toContain("This *does not* change for each commitment transaction");
    expect(commitmentScripts).toContain("Payment Basepoint");

    const htlcFeesDust = chapterMarkdown("htlc-fees-dust");
    expect(htlcFeesDust).toContain('`"value"`');
    expect(htlcFeesDust).toContain('`"script"`');
    expect(htlcFeesDust).toContain('`"cltv_expiry"`');
    expect(htlcFeesDust).toContain("663 * feerate_per_kw // 1000");
    expect(htlcFeesDust).toContain("703 * feerate_per_kw // 1000");
  });

  it("writes a machine-readable BOLT audit summary", () => {
    const vectorBackedExercises = Object.entries(LIGHTNING_EXERCISES)
      .filter(([, exercise]) => exercise.testCode.includes("BOLT 3 vector"))
      .map(([id]) => id)
      .sort();

    const summary = {
      generatedAt: new Date().toISOString(),
      vectorBackedExerciseCount: vectorBackedExercises.length,
      vectorBackedExercises,
      chapters: auditChapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        blockTypes: chapter.blocks.map((block) => block.type),
        checkpointIds: chapter.blocks.flatMap((block) => {
          if (block.type === "checkpoint") return [block.id];
          if (block.type === "checkpoint-group") return [block.id, ...block.questionIds];
          if (block.type === "drag-drop") return [block.id];
          if (block.type === "generator") return [block.id];
          if (block.type === "exercises") return block.exerciseIds;
          return [];
        }),
        isReadOnly: chapter.isReadOnly,
      })),
      findings: [] as string[],
    };

    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify(summary, null, 2), "utf8");

    expect(fs.existsSync(REPORT_PATH)).toBe(true);
  });
});
