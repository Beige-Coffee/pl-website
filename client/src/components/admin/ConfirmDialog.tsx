interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: "red" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ title, message, confirmLabel = "Confirm", confirmColor = "default", onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative border-4 border-border bg-card p-6 pixel-shadow max-w-md w-full mx-4">
        <h3 className="font-pixel text-sm mb-3">{title}</h3>
        <p className="text-sm text-foreground/70 mb-6" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="font-pixel text-[10px] border-2 border-border px-4 py-2 hover:bg-primary/10 cursor-pointer"
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            className={`font-pixel text-[10px] border-2 px-4 py-2 cursor-pointer ${
              confirmColor === "red"
                ? "border-red-500 bg-red-500/10 text-red-600 hover:bg-red-500/20"
                : "border-border bg-primary text-black hover:bg-primary/80"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
