import { useParams, useLocation } from "wouter";
import { useCallback, useEffect } from "react";
import "../visual-lightning/styles/visual-lightning.css";
import { VLLayout } from "../visual-lightning/components/VLLayout";
import { VLSection } from "../visual-lightning/components/VLSection";
import { VL_SECTIONS } from "../visual-lightning/data/vl-sections";
import { useVLProgress } from "../visual-lightning/hooks/use-vl-progress";

/** The set of sections that have real content (not stubs). */
const ACTIVE_SECTIONS = new Set(["1", "2", "3", "4", "5", "6", "7", "8"]);

function isSectionUnlocked(sectionId: string, completedSections: string[]): boolean {
  if (!ACTIVE_SECTIONS.has(sectionId)) return false;
  if (sectionId === "1") return true;
  const prevId = String(parseInt(sectionId, 10) - 1);
  return completedSections.includes(prevId);
}

export default function VisualLightningPage() {
  const params = useParams<{ sectionId?: string }>();
  const [, setLocation] = useLocation();
  const { completedSections, markComplete } = useVLProgress();

  const sectionId = params.sectionId || "1";
  const section = VL_SECTIONS.find((s) => s.id === sectionId) || VL_SECTIONS[0];

  const handleNavigate = useCallback(
    (id: string) => {
      setLocation(id === "1" ? "/visual-lightning" : `/visual-lightning/${id}`);
      window.scrollTo(0, 0);
    },
    [setLocation],
  );

  // TODO: Re-enable redirect guard when quiz gating is turned back on
  // useEffect(() => {
  //   if (!isSectionUnlocked(section.id, completedSections)) {
  //     let furthest = "1";
  //     for (const s of VL_SECTIONS) {
  //       if (isSectionUnlocked(s.id, completedSections)) furthest = s.id;
  //       else break;
  //     }
  //     handleNavigate(furthest);
  //   }
  // }, [section.id, completedSections, handleNavigate]);

  const handleQuizComplete = useCallback(() => {
    markComplete(section.id);
  }, [markComplete, section.id]);

  // Navigate to the next section after quiz completion
  const handleNextSection = useCallback(() => {
    const nextId = String(parseInt(section.id, 10) + 1);
    if (ACTIVE_SECTIONS.has(nextId)) {
      handleNavigate(nextId);
    }
  }, [section.id, handleNavigate]);

  return (
    <div className="vl-root min-h-screen">
      <VLLayout
        currentSectionId={section.id}
        completedSections={completedSections}
        onNavigate={handleNavigate}
      >
        <VLSection
          key={section.id}
          content={section.content}
          onQuizComplete={handleQuizComplete}
          onNextSection={handleNextSection}
        />
      </VLLayout>
    </div>
  );
}
