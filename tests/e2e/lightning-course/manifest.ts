import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  chapters,
  CHAPTER_REQUIREMENTS,
} from "../../../client/src/pages/lightning-tutorial.tsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_PUBLIC_DIR = path.resolve(__dirname, "../../../client/public");

export type CourseBlock =
  | { type: "drag-drop"; id: string }
  | { type: "checkpoint"; id: string }
  | { type: "checkpoint-group"; id: string; questionIds: string[] }
  | { type: "exercises"; exerciseIds: string[] }
  | { type: "generator"; id: string };

export interface CourseChapterManifest {
  id: string;
  title: string;
  section: (typeof chapters)[number]["section"];
  filePath: string | null;
  markdown: string | null;
  blocks: CourseBlock[];
  imagePaths: string[];
  detailsCount: number;
  isReadOnly: boolean;
}

const BLOCK_RE =
  /<drag-drop\s+id="([^"]+)"[^>]*>|<checkpoint-group\s+id="([^"]+)"\s+ids="([^"]+)"[^>]*>|<checkpoint\s+id="([^"]+)"[^>]*>|<code-intro[^>]+exercises="([^"]+)"[^>]*>|<tx-generator\s+id="([^"]+)"[^>]*>/g;

function extractImagePaths(markdown: string): string[] {
  const images: string[] = [];
  const imageRe = /<img[^>]+src="\.\/tutorial_images\/([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = imageRe.exec(markdown)) !== null) {
    images.push(match[1]);
  }
  return images;
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

  return blocks;
}

export function buildLightningCourseManifest(): CourseChapterManifest[] {
  return chapters.map((chapter) => {
    const filePath = chapter.file
      ? path.resolve(CLIENT_PUBLIC_DIR, chapter.file.replace(/^\//, ""))
      : null;
    const markdown = filePath && fs.existsSync(filePath)
      ? fs.readFileSync(filePath, "utf8")
      : null;
    const reqs = CHAPTER_REQUIREMENTS[chapter.id];
    const isReadOnly = !!reqs &&
      reqs.checkpoints.length === 0 &&
      reqs.exercises.length === 0 &&
      chapter.id !== "quiz" &&
      chapter.id !== "pay-it-forward";

    return {
      id: chapter.id,
      title: chapter.title,
      section: chapter.section,
      filePath,
      markdown,
      blocks: markdown ? extractBlocks(markdown) : [],
      imagePaths: markdown ? extractImagePaths(markdown) : [],
      detailsCount: markdown ? (markdown.match(/<details>/g) || []).length : 0,
      isReadOnly,
    };
  });
}

export function expectedCheckpointIdsForChapter(chapter: CourseChapterManifest): string[] {
  const ids = new Set<string>();

  for (const block of chapter.blocks) {
    if (block.type === "drag-drop" || block.type === "checkpoint" || block.type === "generator") {
      ids.add(block.id);
    } else if (block.type === "checkpoint-group") {
      ids.add(block.id);
      for (const qid of block.questionIds) ids.add(qid);
    } else if (block.type === "exercises") {
      for (const exerciseId of block.exerciseIds) ids.add(exerciseId);
    }
  }

  return [...ids];
}

export function expectedProgressKeysForChapter(chapter: CourseChapterManifest): string[] {
  if (!chapter.isReadOnly) return [];
  return [`chapter-read:${chapter.id}`];
}
