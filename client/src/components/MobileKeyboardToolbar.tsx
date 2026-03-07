import type { EditorView } from "@codemirror/view";

const KEYS = [
  { label: "Tab", insert: "    " },
  { label: "(", insert: "(" },
  { label: ")", insert: ")" },
  { label: "[", insert: "[" },
  { label: "]", insert: "]" },
  { label: "{", insert: "{" },
  { label: "}", insert: "}" },
  { label: ":", insert: ":" },
  { label: "=", insert: "=" },
  { label: '"', insert: '"' },
  { label: "_", insert: "_" },
];

interface MobileKeyboardToolbarProps {
  editorView: EditorView | null;
  visible: boolean;
}

export default function MobileKeyboardToolbar({ editorView, visible }: MobileKeyboardToolbarProps) {
  if (!visible || !editorView) return null;

  const handleInsert = (text: string) => {
    const { from, to } = editorView.state.selection.main;
    editorView.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
    editorView.focus();
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-[60] flex overflow-x-auto gap-1 px-2 py-1.5 bg-[#1a1a2e] border-t border-white/10" data-testid="container-mobile-keyboard-toolbar">
      {KEYS.map((k) => (
        <button
          key={k.label}
          type="button"
          data-testid={`button-mobile-key-${k.label}`}
          onPointerDown={(e) => {
            e.preventDefault(); // Prevent blur
            handleInsert(k.insert);
          }}
          className="min-w-[40px] min-h-[36px] px-2 font-mono text-sm text-slate-200 bg-white/10 rounded active:bg-white/20 shrink-0"
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}
