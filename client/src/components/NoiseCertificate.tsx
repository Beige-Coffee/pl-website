/**
 * NoiseCertificate — Shareable completion certificate for the Noise Protocol course.
 *
 * Renders a dark card with gold accents showing the student's node pubkey,
 * completion date, and server-signed token. Supports PNG download via
 * html-to-image and sharing on Twitter.
 *
 * Displayed inside CapstonePanel after the student sends their first
 * successful message over the encrypted transport.
 */

import { useRef, useState, useCallback } from "react";
import { toPng } from "html-to-image";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Download, Share2, X, Award } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface NoiseCertificateProps {
  studentPubkey: string; // hex string of student's static pubkey
  completionToken?: string; // hex string of server-signed token
  completionDate: Date;
  onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Truncate a hex pubkey to show first/last N chars with ellipsis */
function truncatePubkey(hex: string, chars = 8): string {
  if (hex.length <= chars * 2 + 3) return hex;
  return `${hex.slice(0, chars)}...${hex.slice(-chars)}`;
}

/** Format a date nicely for the certificate */
function formatCertDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export default function NoiseCertificate({
  studentPubkey,
  completionToken,
  completionDate,
  onClose,
}: NoiseCertificateProps) {
  const certRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!certRef.current) return;
    setDownloading(true);

    try {
      const dataUrl = await toPng(certRef.current, {
        pixelRatio: 2,
        backgroundColor: "#0f1930",
      });

      const link = document.createElement("a");
      link.download = "noise-protocol-certificate.png";
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to generate certificate image:", err);
    } finally {
      setDownloading(false);
    }
  }, []);

  const handleShareTwitter = useCallback(() => {
    const text = encodeURIComponent(
      "I just completed the Noise Protocol course on Programming Lightning! I built a working encrypted channel using the same protocol that powers Lightning Network nodes."
    );
    const url = encodeURIComponent(
      "https://programminglightning.com/noise-tutorial"
    );
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      "_blank",
      "noopener,noreferrer"
    );
  }, []);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl bg-[#0b1220] border-[#2a3552] p-0 overflow-hidden">
        {/* Accessible title/description for screen readers */}
        <DialogTitle className="sr-only">Certificate of Completion</DialogTitle>
        <DialogDescription className="sr-only">
          Your Noise Protocol course completion certificate
        </DialogDescription>

        {/* ── Certificate Card (captured for PNG) ── */}
        <div
          ref={certRef}
          className="relative p-8 sm:p-10"
          style={{ backgroundColor: "#0f1930", fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
        >
          {/* Gold border frame */}
          <div
            className="absolute inset-3 sm:inset-4 border-2 rounded-lg pointer-events-none"
            style={{ borderColor: "#FFD700" }}
          />

          {/* Inner gold accent line */}
          <div
            className="absolute inset-4 sm:inset-5 border rounded-lg pointer-events-none"
            style={{ borderColor: "rgba(255, 215, 0, 0.25)" }}
          />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center text-center space-y-5">
            {/* Award icon */}
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: "rgba(255, 215, 0, 0.12)",
                border: "1.5px solid rgba(255, 215, 0, 0.4)",
              }}
            >
              <Award
                className="w-6 h-6"
                style={{ color: "#FFD700" }}
              />
            </div>

            {/* Course title */}
            <div>
              <div
                className="text-xs tracking-[0.25em] uppercase mb-2"
                style={{ color: "rgba(255, 215, 0, 0.7)" }}
              >
                Certificate of Completion
              </div>
              <h2
                className="text-xl sm:text-2xl font-bold tracking-wide"
                style={{ color: "#FFD700" }}
              >
                Programming Lightning
              </h2>
              <div
                className="text-sm sm:text-base font-medium mt-1"
                style={{ color: "rgba(255, 215, 0, 0.6)" }}
              >
                Noise Protocol
              </div>
            </div>

            {/* Divider */}
            <div
              className="w-24 h-px"
              style={{ backgroundColor: "rgba(255, 215, 0, 0.3)" }}
            />

            {/* Node pubkey */}
            <div className="space-y-1.5">
              <div
                className="text-[10px] tracking-widest uppercase"
                style={{ color: "rgba(148, 163, 184, 0.6)" }}
              >
                Node Public Key
              </div>
              <div
                className="text-sm sm:text-base tracking-wider px-4 py-1.5 rounded"
                style={{
                  color: "#e2e8f0",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                }}
                title={studentPubkey}
              >
                {truncatePubkey(studentPubkey, 10)}
              </div>
            </div>

            {/* Completion date */}
            <div className="space-y-1">
              <div
                className="text-[10px] tracking-widest uppercase"
                style={{ color: "rgba(148, 163, 184, 0.6)" }}
              >
                Completed
              </div>
              <div
                className="text-sm"
                style={{ color: "#94a3b8" }}
              >
                {formatCertDate(completionDate)}
              </div>
            </div>

            {/* Completion token */}
            {completionToken && (
              <div className="space-y-1">
                <div
                  className="text-[10px] tracking-widest uppercase"
                  style={{ color: "rgba(148, 163, 184, 0.6)" }}
                >
                  Verification Token
                </div>
                <div
                  className="text-xs tracking-wider"
                  style={{ color: "rgba(148, 163, 184, 0.5)" }}
                >
                  {truncatePubkey(completionToken, 12)}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-2">
              <div
                className="text-[10px] tracking-wider"
                style={{ color: "rgba(148, 163, 184, 0.35)" }}
              >
                programminglightning.com
              </div>
            </div>
          </div>
        </div>

        {/* ── Action Buttons (outside cert capture area) ── */}
        <div
          className="flex items-center justify-center gap-3 px-6 pb-6 pt-2"
          style={{ backgroundColor: "#0b1220" }}
        >
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border-2 transition-all"
            style={{
              borderColor: "#FFD700",
              backgroundColor: "rgba(255, 215, 0, 0.1)",
              color: "#FFD700",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget.style.backgroundColor =
                "rgba(255, 215, 0, 0.2)");
            }}
            onMouseLeave={(e) => {
              (e.currentTarget.style.backgroundColor =
                "rgba(255, 215, 0, 0.1)");
            }}
          >
            <Download className="w-3.5 h-3.5" />
            {downloading ? "Generating..." : "Download as Image"}
          </button>

          <button
            onClick={handleShareTwitter}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border-2 transition-all"
            style={{
              borderColor: "#3b82f6",
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              color: "#60a5fa",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget.style.backgroundColor =
                "rgba(59, 130, 246, 0.2)");
            }}
            onMouseLeave={(e) => {
              (e.currentTarget.style.backgroundColor =
                "rgba(59, 130, 246, 0.1)");
            }}
          >
            <Share2 className="w-3.5 h-3.5" />
            Share on Twitter
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border-2 transition-all"
            style={{
              borderColor: "#2a3552",
              backgroundColor: "rgba(15, 25, 48, 0.8)",
              color: "#94a3b8",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget.style.backgroundColor =
                "rgba(42, 53, 82, 0.4)");
            }}
            onMouseLeave={(e) => {
              (e.currentTarget.style.backgroundColor =
                "rgba(15, 25, 48, 0.8)");
            }}
          >
            <X className="w-3.5 h-3.5" />
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
