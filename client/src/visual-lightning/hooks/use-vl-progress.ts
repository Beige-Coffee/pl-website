import { useState, useCallback } from "react";

const STORAGE_KEY = "vl-progress";

function readProgress(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useVLProgress() {
  const [completedSections, setCompletedSections] = useState<string[]>(readProgress);

  const markComplete = useCallback((sectionId: string) => {
    setCompletedSections((prev) => {
      if (prev.includes(sectionId)) return prev;
      const next = [...prev, sectionId];
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isComplete = useCallback(
    (sectionId: string) => completedSections.includes(sectionId),
    [completedSections],
  );

  return { completedSections, markComplete, isComplete };
}
