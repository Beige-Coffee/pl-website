/**
 * SharedSecretsDiagram -- shows how ECDH key exchange works between Alice
 * and Bob. Two rows converge on the same "shared_secret" box in the middle:
 *
 *   Alice's session key (private) + Bob's public key -> shared_secret
 *   Bob's private key + Alice's ephemeral public key -> same shared_secret
 *
 * Uses SVG with arrows and key labels. Emphasizes that both sides compute
 * the same value without revealing private keys.
 *
 * Embed via the `<shared-secrets></shared-secrets>` custom tag.
 */

import { cn } from "@/lib/utils";
import { Lock, Key } from "lucide-react";

export interface SharedSecretsDiagramProps {
  className?: string;
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const SVG_WIDTH = 720;
const SVG_HEIGHT = 260;
const CENTER_X = SVG_WIDTH / 2;
const CENTER_Y = SVG_HEIGHT / 2;

// Shared secret box
const SECRET_BOX_W = 160;
const SECRET_BOX_H = 44;

// Key box sizes
const KEY_BOX_W = 140;
const KEY_BOX_H = 36;

// Positions for key boxes (two rows: Alice's computation on top, Bob's on bottom)
const ROW_TOP_Y = 50;
const ROW_BOT_Y = SVG_HEIGHT - 50;

const ALICE_PRIV_X = CENTER_X - 130;
const BOB_PUB_X = CENTER_X + 130;

const BOB_PRIV_X = CENTER_X - 130;
const ALICE_PUB_X = CENTER_X + 130;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KeyBox({
  x,
  y,
  label,
  sublabel,
  fillColor,
  strokeColor,
  textColor,
  isPrivate,
}: {
  x: number;
  y: number;
  label: string;
  sublabel: string;
  fillColor: string;
  strokeColor: string;
  textColor: string;
  isPrivate: boolean;
}) {
  return (
    <g>
      <rect
        x={x - KEY_BOX_W / 2}
        y={y - KEY_BOX_H / 2}
        width={KEY_BOX_W}
        height={KEY_BOX_H}
        rx={4}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={isPrivate ? 2 : 1.5}
        strokeDasharray={isPrivate ? undefined : "4 3"}
      />
      {/* Icon area */}
      <text
        x={x - KEY_BOX_W / 2 + 16}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={14}
        fill={textColor}
        style={{ pointerEvents: "none" }}
      >
        {isPrivate ? "\uD83D\uDD12" : "\uD83D\uDD11"}
      </text>
      {/* Label */}
      <text
        x={x + 4}
        y={y - 6}
        textAnchor="middle"
        dominantBaseline="auto"
        fill={textColor}
        fontSize={11}
        fontWeight={700}
        fontFamily="system-ui, -apple-system, sans-serif"
        style={{ pointerEvents: "none" }}
      >
        {label}
      </text>
      <text
        x={x + 4}
        y={y + 10}
        textAnchor="middle"
        dominantBaseline="auto"
        fill={textColor}
        fontSize={9}
        fontFamily="system-ui, -apple-system, sans-serif"
        opacity={0.7}
        style={{ pointerEvents: "none" }}
      >
        {sublabel}
      </text>
    </g>
  );
}

function ArrowPath({
  startX,
  startY,
  endX,
  endY,
  color,
}: {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
}) {
  // Curved path from key box to center
  const midY = (startY + endY) / 2;
  const d = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
  const arrowSize = 5;

  // Calculate arrow direction (pointing down for top row, up for bottom row)
  const goingDown = endY > startY;
  const tipY = endY;
  const ay1 = goingDown ? tipY - arrowSize : tipY + arrowSize;

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeOpacity={0.5}
      />
      <polygon
        points={`${endX},${tipY} ${endX - arrowSize},${ay1} ${endX + arrowSize},${ay1}`}
        fill={color}
        fillOpacity={0.5}
      />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SharedSecretsDiagram({ className }: SharedSecretsDiagramProps) {
  return (
    <div className={cn("my-8", className)}>
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full"
        style={{ maxWidth: SVG_WIDTH, height: "auto" }}
        role="img"
        aria-label="ECDH key exchange: Alice and Bob independently compute the same shared secret"
      >
        {/* ---- Row labels ---- */}
        <text
          x={40}
          y={ROW_TOP_Y + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
          fontSize={11}
          fontWeight={700}
          fontFamily="system-ui, -apple-system, sans-serif"
          opacity={0.5}
        >
          Alice
        </text>
        <text
          x={40}
          y={ROW_BOT_Y + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
          fontSize={11}
          fontWeight={700}
          fontFamily="system-ui, -apple-system, sans-serif"
          opacity={0.5}
        >
          Bob
        </text>

        {/* ---- Top row: Alice's computation ---- */}
        <KeyBox
          x={ALICE_PRIV_X}
          y={ROW_TOP_Y}
          label="session_key"
          sublabel="(Alice's private)"
          fillColor="#3b82f620"
          strokeColor="#3b82f6"
          textColor="#3b82f6"
          isPrivate={true}
        />

        {/* Multiply symbol */}
        <text
          x={CENTER_X}
          y={ROW_TOP_Y + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
          fontSize={16}
          fontWeight={700}
          fontFamily="system-ui, -apple-system, sans-serif"
          opacity={0.4}
        >
          *
        </text>

        <KeyBox
          x={BOB_PUB_X}
          y={ROW_TOP_Y}
          label="Bob_pubkey"
          sublabel="(Bob's public)"
          fillColor="#22c55e15"
          strokeColor="#22c55e"
          textColor="#22c55e"
          isPrivate={false}
        />

        {/* Arrows from top row to center */}
        <ArrowPath
          startX={ALICE_PRIV_X}
          startY={ROW_TOP_Y + KEY_BOX_H / 2}
          endX={CENTER_X - 20}
          endY={CENTER_Y - SECRET_BOX_H / 2}
          color="#3b82f6"
        />
        <ArrowPath
          startX={BOB_PUB_X}
          startY={ROW_TOP_Y + KEY_BOX_H / 2}
          endX={CENTER_X + 20}
          endY={CENTER_Y - SECRET_BOX_H / 2}
          color="#22c55e"
        />

        {/* ---- Center: shared secret box ---- */}
        <rect
          x={CENTER_X - SECRET_BOX_W / 2}
          y={CENTER_Y - SECRET_BOX_H / 2}
          width={SECRET_BOX_W}
          height={SECRET_BOX_H}
          rx={6}
          fill="#f59e0b18"
          stroke="#f59e0b"
          strokeWidth={2.5}
        />
        <text
          x={CENTER_X}
          y={CENTER_Y - 5}
          textAnchor="middle"
          dominantBaseline="auto"
          fill="#f59e0b"
          fontSize={13}
          fontWeight={700}
          fontFamily="system-ui, -apple-system, sans-serif"
          style={{ pointerEvents: "none" }}
        >
          shared_secret
        </text>
        <text
          x={CENTER_X}
          y={CENTER_Y + 12}
          textAnchor="middle"
          dominantBaseline="auto"
          fill="#f59e0b"
          fontSize={9}
          fontFamily="system-ui, -apple-system, sans-serif"
          opacity={0.7}
          style={{ pointerEvents: "none" }}
        >
          SHA256(shared_point.x)
        </text>

        {/* "=" sign between arrows and box */}
        <text
          x={CENTER_X - SECRET_BOX_W / 2 - 14}
          y={CENTER_Y + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
          fontSize={14}
          fontWeight={700}
          fontFamily="system-ui, -apple-system, sans-serif"
          opacity={0.3}
        >
          =
        </text>
        <text
          x={CENTER_X + SECRET_BOX_W / 2 + 14}
          y={CENTER_Y + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
          fontSize={14}
          fontWeight={700}
          fontFamily="system-ui, -apple-system, sans-serif"
          opacity={0.3}
        >
          =
        </text>

        {/* ---- Bottom row: Bob's computation ---- */}
        <KeyBox
          x={BOB_PRIV_X}
          y={ROW_BOT_Y}
          label="bob_private_key"
          sublabel="(Bob's private)"
          fillColor="#22c55e20"
          strokeColor="#22c55e"
          textColor="#22c55e"
          isPrivate={true}
        />

        {/* Multiply symbol */}
        <text
          x={CENTER_X}
          y={ROW_BOT_Y + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
          fontSize={16}
          fontWeight={700}
          fontFamily="system-ui, -apple-system, sans-serif"
          opacity={0.4}
        >
          *
        </text>

        <KeyBox
          x={ALICE_PUB_X}
          y={ROW_BOT_Y}
          label="session_pubkey"
          sublabel="(Alice's public)"
          fillColor="#3b82f615"
          strokeColor="#3b82f6"
          textColor="#3b82f6"
          isPrivate={false}
        />

        {/* Arrows from bottom row to center */}
        <ArrowPath
          startX={BOB_PRIV_X}
          startY={ROW_BOT_Y - KEY_BOX_H / 2}
          endX={CENTER_X - 20}
          endY={CENTER_Y + SECRET_BOX_H / 2}
          color="#22c55e"
        />
        <ArrowPath
          startX={ALICE_PUB_X}
          startY={ROW_BOT_Y - KEY_BOX_H / 2}
          endX={CENTER_X + 20}
          endY={CENTER_Y + SECRET_BOX_H / 2}
          color="#3b82f6"
        />

        {/* ---- "Same result!" callout ---- */}
        <text
          x={CENTER_X}
          y={CENTER_Y + SECRET_BOX_H / 2 + 18}
          textAnchor="middle"
          dominantBaseline="auto"
          fill="currentColor"
          fontSize={10}
          fontFamily="system-ui, -apple-system, sans-serif"
          opacity={0.45}
          fontStyle="italic"
        >
          a * B = a * (b * G) = b * (a * G) = b * A
        </text>
      </svg>

      {/* Caption below */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-6 mt-2 px-1">
        <div className="flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <p className="text-xs font-sans text-muted-foreground">
            <span className="font-semibold">Private keys</span> never leave their owner.
            Solid borders indicate private (secret) values.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Key className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <p className="text-xs font-sans text-muted-foreground">
            <span className="font-semibold">Public keys</span> are freely shared.
            Dashed borders indicate public values.
          </p>
        </div>
      </div>
    </div>
  );
}
