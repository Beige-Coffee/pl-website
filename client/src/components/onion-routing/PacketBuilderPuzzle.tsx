import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Check, X, RotateCcw, ArrowUpDown } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PacketBuilderPuzzleProps {
  className?: string;
}

interface OperationTile {
  id: number;
  label: string;
  description: string;
}

type ValidationState =
  | { type: "idle" }
  | { type: "correct" }
  | { type: "incorrect"; wrongIndices: Set<number> };

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

/** The tiles in their correct order (index 0 = slot 1, etc.) */
const OPERATIONS: OperationTile[] = [
  { id: 0, label: "Shift Right", description: "Move existing data to make room" },
  { id: 1, label: "Insert Payload + HMAC", description: "Place hop data at the front" },
  { id: 2, label: "XOR with Rho Stream", description: "Encrypt the entire payload" },
  { id: 3, label: "Apply Filler", description: "Fix trailing bytes (innermost hop only)" },
  { id: 4, label: "Compute HMAC", description: "Authenticate the encrypted payload" },
];

/** Deterministic initial scramble: a fixed permutation that is NOT the correct order */
const INITIAL_ORDER = [2, 4, 0, 1, 3]; // XOR, HMAC, Shift, Insert, Filler

const CORRECT_ORDER = [0, 1, 2, 3, 4];

function isCorrectOrder(order: number[]): boolean {
  return order.every((id, i) => id === CORRECT_ORDER[i]);
}

/** Find which slots have the wrong tile */
function findWrongIndices(order: number[]): Set<number> {
  const wrong = new Set<number>();
  order.forEach((id, i) => {
    if (id !== CORRECT_ORDER[i]) wrong.add(i);
  });
  return wrong;
}

/** Shuffle an array (Fisher-Yates), ensuring result differs from correct order */
function scramble(): number[] {
  const arr = [...CORRECT_ORDER];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  // If we accidentally got the correct order, swap the first two
  if (isCorrectOrder(arr)) {
    [arr[0], arr[1]] = [arr[1], arr[0]];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PacketBuilderPuzzle({ className }: PacketBuilderPuzzleProps) {
  const [order, setOrder] = useState<number[]>(INITIAL_ORDER);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [validation, setValidation] = useState<ValidationState>({ type: "idle" });

  const isSolved = validation.type === "correct";

  const handleTileClick = useCallback(
    (slotIndex: number) => {
      if (isSolved) return;

      if (selectedSlot === null) {
        // Select this tile
        setSelectedSlot(slotIndex);
        // Clear previous validation when user starts moving things
        if (validation.type === "incorrect") {
          setValidation({ type: "idle" });
        }
      } else if (selectedSlot === slotIndex) {
        // Deselect
        setSelectedSlot(null);
      } else {
        // Swap the two tiles
        setOrder((prev) => {
          const next = [...prev];
          [next[selectedSlot], next[slotIndex]] = [next[slotIndex], next[selectedSlot]];
          return next;
        });
        setSelectedSlot(null);
        // Clear validation on swap
        if (validation.type !== "idle") {
          setValidation({ type: "idle" });
        }
      }
    },
    [selectedSlot, isSolved, validation.type],
  );

  const handleCheck = useCallback(() => {
    if (isCorrectOrder(order)) {
      setValidation({ type: "correct" });
      setSelectedSlot(null);
    } else {
      setValidation({ type: "incorrect", wrongIndices: findWrongIndices(order) });
      setSelectedSlot(null);
    }
  }, [order]);

  const handleReset = useCallback(() => {
    setOrder(scramble());
    setSelectedSlot(null);
    setValidation({ type: "idle" });
  }, []);

  return (
    <div
      className={cn(
        "my-8 border-2 border-foreground/20 bg-card/50 p-4 sm:p-6",
        className,
      )}
    >
      {/* Header */}
      <div className="mb-5 flex items-center gap-2">
        <ArrowUpDown className="h-5 w-5 text-foreground/70" />
        <h3 className="font-sans text-base tracking-wide text-foreground">
          PUZZLE IT OUT
        </h3>
      </div>
      <p className="mb-5 font-sans text-sm text-muted-foreground leading-relaxed">
        Arrange the five wrapping operations in the correct order for one iteration
        of the onion construction loop. Click a tile to select it, then click another
        tile to swap their positions.
      </p>

      {/* Tile slots */}
      <div className="space-y-2">
        {order.map((tileId, slotIndex) => {
          const tile = OPERATIONS[tileId];
          const isSelected = selectedSlot === slotIndex;
          const isWrong =
            validation.type === "incorrect" &&
            validation.wrongIndices.has(slotIndex);
          const isRight =
            validation.type === "correct" ||
            (validation.type === "incorrect" &&
              !validation.wrongIndices.has(slotIndex) &&
              order[slotIndex] === CORRECT_ORDER[slotIndex]);

          return (
            <button
              key={`slot-${slotIndex}`}
              onClick={() => handleTileClick(slotIndex)}
              disabled={isSolved}
              className={cn(
                "group flex w-full items-start gap-3 border-2 px-3 py-2.5 sm:px-4 sm:py-3 text-left font-sans transition-all duration-150",
                // Base states
                !isSolved && "cursor-pointer",
                isSolved && "cursor-default",
                // Selected
                isSelected &&
                  "border-amber-400 bg-amber-400/10 dark:border-amber-500 dark:bg-amber-500/10",
                // Wrong
                isWrong &&
                  !isSelected &&
                  "border-red-500/70 bg-red-500/5 dark:border-red-500/60 dark:bg-red-500/10",
                // Correct (solved or confirmed-correct individual tile)
                isSolved &&
                  "border-green-500/60 bg-green-500/5 dark:border-green-500/50 dark:bg-green-500/10",
                // Idle / neutral
                !isSelected &&
                  !isWrong &&
                  !isSolved &&
                  "border-foreground/15 bg-transparent hover:border-foreground/30 hover:bg-foreground/[0.03]",
              )}
            >
              {/* Slot number */}
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border text-xs font-bold",
                  isSolved
                    ? "border-green-500/50 text-green-600 dark:text-green-400"
                    : isWrong
                      ? "border-red-500/50 text-red-500 dark:text-red-400"
                      : isSelected
                        ? "border-amber-400 text-amber-600 dark:text-amber-400"
                        : "border-foreground/20 text-muted-foreground",
                )}
              >
                {isSolved ? (
                  <Check className="h-3.5 w-3.5" />
                ) : isWrong ? (
                  <X className="h-3.5 w-3.5" />
                ) : (
                  slotIndex + 1
                )}
              </span>

              {/* Tile content */}
              <div className="min-w-0 flex-1">
                <span
                  className={cn(
                    "text-sm font-bold",
                    isSolved
                      ? "text-green-700 dark:text-green-300"
                      : isWrong
                        ? "text-red-600 dark:text-red-400"
                        : "text-foreground",
                  )}
                >
                  {tile.label}
                </span>
                <span className="ml-2 text-xs text-muted-foreground hidden sm:inline">
                  &mdash; {tile.description}
                </span>
                <span className="block text-xs text-muted-foreground sm:hidden mt-0.5">
                  {tile.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Validation feedback */}
      {validation.type === "incorrect" && (
        <div className="mt-4 border-2 border-red-500/30 bg-red-500/5 px-4 py-3 font-sans text-sm text-red-600 dark:text-red-400">
          <p className="font-bold">Not quite!</p>
          <p className="mt-1 text-xs leading-relaxed opacity-80">
            Hint: Think about what needs to happen before you can encrypt. You need
            space in the buffer before you can insert data, and you need to insert data
            before you can encrypt it.
          </p>
        </div>
      )}

      {validation.type === "correct" && (
        <div className="mt-4 border-2 border-green-500/30 bg-green-500/5 px-4 py-3 font-sans text-sm text-green-700 dark:text-green-400">
          <p className="font-bold">Correct!</p>
          <p className="mt-1 text-xs leading-relaxed opacity-80">
            The order matters because each step depends on the previous one. You must
            shift first to make room, then insert the payload and HMAC into that space,
            then encrypt everything with XOR. Filler corrects the trailing bytes
            (innermost hop only), and finally the HMAC authenticates the encrypted
            result. Encrypting before inserting would encrypt the wrong data, and
            computing the HMAC before encrypting would authenticate plaintext instead
            of ciphertext.
          </p>
        </div>
      )}

      {/* Buttons */}
      <div className="mt-4 flex items-center gap-3">
        {!isSolved && (
          <button
            onClick={handleCheck}
            className={cn(
              "inline-flex items-center gap-2 border-2 px-4 py-2 font-sans text-sm tracking-wide transition-colors",
              "border-foreground text-foreground hover:bg-foreground hover:text-background cursor-pointer",
            )}
          >
            <Check className="h-4 w-4" />
            CHECK ORDER
          </button>
        )}
        <button
          onClick={handleReset}
          className={cn(
            "inline-flex items-center gap-2 border-2 px-4 py-2 font-sans text-sm tracking-wide transition-colors cursor-pointer",
            "border-foreground/30 text-muted-foreground hover:border-foreground/50 hover:text-foreground",
          )}
        >
          <RotateCcw className="h-4 w-4" />
          {isSolved ? "TRY AGAIN" : "SCRAMBLE"}
        </button>
      </div>
    </div>
  );
}
