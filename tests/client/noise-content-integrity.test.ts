import { describe, it, expect, vi } from "vitest";
import path from "path";

// The global test setup mocks fs — restore the real module for this file
vi.unmock("fs");
import fs from "fs";
import {
  CHECKPOINT_QUESTIONS,
  CHAPTER_REQUIREMENTS,
  chapters,
  sectionOrder,
} from "../../client/src/pages/noise-tutorial";
import { CODE_EXERCISES } from "../../client/src/data/code-exercises";
import { CHECKPOINT_ANSWER_KEY } from "../../server/routes";

const TUTORIAL_DIR = path.resolve(__dirname, "../../client/noise_tutorial");
const IMAGE_DIR = path.join(TUTORIAL_DIR, "tutorial_images");

/** Read all markdown files referenced by chapters and return {chapterId, filePath, content} */
function loadMarkdownFiles() {
  const results: { chapterId: string; filePath: string; content: string }[] = [];
  for (const ch of chapters) {
    if (ch.file) {
      const absPath = path.resolve(__dirname, "../../client", ch.file.replace(/^\//, ""));
      if (fs.existsSync(absPath)) {
        results.push({ chapterId: ch.id, filePath: absPath, content: fs.readFileSync(absPath, "utf-8") });
      }
    }
  }
  return results;
}

/** Extract all exercise IDs from <code-intro exercises="..."> tags */
function extractExerciseIds(content: string): string[] {
  const ids: string[] = [];
  const re = /<code-intro[^>]+exercises="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    for (const id of match[1].split(",")) {
      const trimmed = id.trim();
      if (trimmed) ids.push(trimmed);
    }
  }
  return ids;
}

/** Extract all checkpoint IDs from <checkpoint id="..."> and <checkpoint-group ids="..."> tags */
function extractCheckpointIds(content: string): string[] {
  const ids: string[] = [];
  // Individual checkpoints: <checkpoint id="...">
  const singleRe = /<checkpoint\s+id="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = singleRe.exec(content)) !== null) {
    ids.push(match[1]);
  }
  // Checkpoint groups: <checkpoint-group ... ids="...">
  const groupRe = /<checkpoint-group[^>]+ids="([^"]+)"/g;
  while ((match = groupRe.exec(content)) !== null) {
    for (const id of match[1].split(",")) {
      const trimmed = id.trim();
      if (trimmed) ids.push(trimmed);
    }
  }
  return ids;
}

/** Extract all image paths from <img src="./tutorial_images/..."> */
function extractImagePaths(content: string): string[] {
  const paths: string[] = [];
  const re = /<img[^>]+src="\.\/tutorial_images\/([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

const mdFiles = loadMarkdownFiles();

describe("Noise Content Integrity", () => {
  // ─── 1. Exercise ID cross-reference ──────────────────────────────────
  describe("exercise IDs in markdown exist in CODE_EXERCISES", () => {
    for (const { chapterId, content } of mdFiles) {
      const ids = extractExerciseIds(content);
      for (const id of ids) {
        it(`${chapterId}: exercise "${id}" exists`, () => {
          expect(CODE_EXERCISES).toHaveProperty(id);
        });
      }
    }
  });

  // ─── 2. Checkpoint ID cross-reference ────────────────────────────────
  describe("checkpoint IDs in markdown exist in CHECKPOINT_QUESTIONS", () => {
    for (const { chapterId, content } of mdFiles) {
      const ids = extractCheckpointIds(content);
      for (const id of ids) {
        it(`${chapterId}: checkpoint "${id}" exists in CHECKPOINT_QUESTIONS`, () => {
          expect(CHECKPOINT_QUESTIONS).toHaveProperty(id);
        });
      }
    }
  });

  // ─── 3. Checkpoint answer key sync ───────────────────────────────────
  describe("every CHECKPOINT_QUESTIONS ID has a server answer key", () => {
    for (const id of Object.keys(CHECKPOINT_QUESTIONS)) {
      it(`"${id}" exists in CHECKPOINT_ANSWER_KEY`, () => {
        expect(CHECKPOINT_ANSWER_KEY).toHaveProperty(id);
      });
    }
  });

  // ─── 4. CHAPTER_REQUIREMENTS IDs are valid ───────────────────────────
  describe("CHAPTER_REQUIREMENTS references valid IDs", () => {
    for (const [chapterId, reqs] of Object.entries(CHAPTER_REQUIREMENTS)) {
      for (const cpId of reqs.checkpoints) {
        it(`${chapterId}: checkpoint "${cpId}" exists in CHECKPOINT_QUESTIONS`, () => {
          expect(CHECKPOINT_QUESTIONS).toHaveProperty(cpId);
        });
      }
      for (const exId of reqs.exercises) {
        it(`${chapterId}: exercise "${exId}" exists in CODE_EXERCISES`, () => {
          expect(CODE_EXERCISES).toHaveProperty(exId);
        });
      }
    }
  });

  // ─── 5. Chapter files exist on disk ──────────────────────────────────
  describe("chapter markdown files exist", () => {
    for (const ch of chapters) {
      if (ch.file) {
        it(`${ch.id}: file "${ch.file}" exists`, () => {
          const absPath = path.resolve(__dirname, "../../client", ch.file!.replace(/^\//, ""));
          expect(fs.existsSync(absPath)).toBe(true);
        });
      }
    }
  });

  // ─── 6. Images referenced in markdown exist ──────────────────────────
  describe("images referenced in markdown exist on disk", () => {
    for (const { chapterId, content } of mdFiles) {
      const images = extractImagePaths(content);
      for (const img of images) {
        it(`${chapterId}: image "${img}" exists`, () => {
          expect(fs.existsSync(path.join(IMAGE_DIR, img))).toBe(true);
        });
      }
    }
  });

  // ─── 7. No orphaned exercises ────────────────────────────────────────
  describe("no orphaned exercises (every noise exercise is referenced by markdown)", () => {
    // Collect all exercise IDs referenced in noise markdown
    const allMdExerciseIds = new Set<string>();
    for (const { content } of mdFiles) {
      for (const id of extractExerciseIds(content)) {
        allMdExerciseIds.add(id);
      }
    }

    // Collect all exercise IDs referenced in CHAPTER_REQUIREMENTS for noise chapters
    const noiseChapterIds = new Set(chapters.map(ch => ch.id));
    const noiseExerciseIds = new Set<string>();
    for (const [chapterId, reqs] of Object.entries(CHAPTER_REQUIREMENTS)) {
      if (noiseChapterIds.has(chapterId)) {
        for (const exId of reqs.exercises) {
          noiseExerciseIds.add(exId);
        }
      }
    }

    for (const id of noiseExerciseIds) {
      it(`exercise "${id}" is referenced in at least one noise markdown file`, () => {
        expect(allMdExerciseIds.has(id)).toBe(true);
      });
    }
  });

  // ─── 8. No duplicate IDs across markdown files ───────────────────────
  describe("no duplicate checkpoint or exercise IDs across markdown files", () => {
    it("no duplicate exercise IDs", () => {
      const seen = new Map<string, string>();
      const duplicates: string[] = [];
      for (const { chapterId, content } of mdFiles) {
        for (const id of extractExerciseIds(content)) {
          if (seen.has(id) && seen.get(id) !== chapterId) {
            duplicates.push(`"${id}" in both ${seen.get(id)} and ${chapterId}`);
          }
          seen.set(id, chapterId);
        }
      }
      expect(duplicates).toEqual([]);
    });

    it("no duplicate checkpoint IDs across different chapters", () => {
      const seen = new Map<string, string>();
      const duplicates: string[] = [];
      for (const { chapterId, content } of mdFiles) {
        for (const id of extractCheckpointIds(content)) {
          if (seen.has(id) && seen.get(id) !== chapterId) {
            duplicates.push(`"${id}" in both ${seen.get(id)} and ${chapterId}`);
          }
          seen.set(id, chapterId);
        }
      }
      expect(duplicates).toEqual([]);
    });
  });

  // ─── 9. HTML tag balance ─────────────────────────────────────────────
  describe("HTML tags are balanced", () => {
    for (const { chapterId, content } of mdFiles) {
      it(`${chapterId}: every <details> has a closing </details>`, () => {
        const opens = (content.match(/<details>/g) || []).length;
        const closes = (content.match(/<\/details>/g) || []).length;
        expect(opens).toBe(closes);
      });

      it(`${chapterId}: <code-outro> count does not exceed <code-intro> count`, () => {
        const intros = (content.match(/<code-intro[\s>]/g) || []).length;
        const outros = (content.match(/<code-outro[\s>]/g) || []).length;
        expect(outros).toBeLessThanOrEqual(intros);
      });
    }
  });

  // ─── 10. Every chapter has a CHAPTER_REQUIREMENTS entry ──────────────
  describe("every chapter has a CHAPTER_REQUIREMENTS entry", () => {
    for (const ch of chapters) {
      it(`chapter "${ch.id}" has requirements defined`, () => {
        expect(CHAPTER_REQUIREMENTS).toHaveProperty(ch.id);
      });
    }
  });

  // ─── 11. Section ordering ────────────────────────────────────────────
  describe("section ordering is consistent", () => {
    it("every chapter section appears in sectionOrder", () => {
      const sectionSet = new Set(sectionOrder);
      for (const ch of chapters) {
        expect(sectionSet.has(ch.section)).toBe(true);
      }
    });

    it("sectionOrder has no unused sections", () => {
      const usedSections = new Set(chapters.map((c) => c.section));
      for (const s of sectionOrder) {
        expect(usedSections.has(s)).toBe(true);
      }
    });
  });
});
