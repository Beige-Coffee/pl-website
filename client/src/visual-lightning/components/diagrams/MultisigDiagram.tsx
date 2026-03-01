import { useState, useRef, useCallback } from "react";
import { VLTooltip } from "../VLTooltip";

const TOOLTIPS: Record<string, { title: string; description: string }> = {
  threshold: {
    title: "Required Signatures (Threshold)",
    description:
      "The number '2' means two signatures are required to spend. This is the 'M' in 'M-of-N' multisig.",
  },
  "alice-pubkey": {
    title: "Alice's Funding Public Key",
    description:
      "Alice's public key for this channel. She must sign with the corresponding private key to authorize any spend from the multisig.",
  },
  "bob-pubkey": {
    title: "Bob's Funding Public Key",
    description:
      "Bob's public key for this channel. He must sign with the corresponding private key to authorize any spend from the multisig.",
  },
  "key-count": {
    title: "Total Keys (N)",
    description:
      "The number '2' here means there are 2 total keys in the multisig. Combined with the threshold, this creates a 2-of-2 multisig.",
  },
  checkmultisig: {
    title: "OP_CHECKMULTISIG",
    description:
      "The Bitcoin opcode that verifies M-of-N signatures. It checks that the required number of valid signatures are present for the given public keys.",
  },
  sha256: {
    title: "SHA256 Hash",
    description:
      "The witness script is hashed with SHA256 to produce a 32-byte script hash. This hash goes into the P2WSH output on-chain, keeping the full script private until spending time.",
  },
  "output-script": {
    title: "P2WSH Output Script",
    description:
      "The on-chain output contains OP_0 followed by the 32-byte hash of the witness script. This is what appears in the funding transaction's output.",
  },
};

export function MultisigDiagram() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleHover = useCallback((region: string, e: React.MouseEvent) => {
    setHovered(region);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (hovered && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    },
    [hovered],
  );

  const regionFill = (region: string) =>
    hovered === region ? "rgba(184, 134, 11, 0.08)" : "white";

  const regionStroke = (region: string) =>
    hovered === region ? "#b8860b" : "#e8dcc8";

  const tooltip = hovered ? TOOLTIPS[hovered] : null;

  return (
    <div ref={containerRef} className="vl-card-3d relative my-6 select-none">
      <div className="vl-card-3d-inner p-4" style={{ overflow: "visible" }}>
        <svg
          viewBox="0 0 720 320"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            width: "100%",
            height: "auto",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {/* Title */}
          <text x="20" y="28" fontSize="13" fontWeight="700" fill="#2a1f0d">
            2-of-2 Multisig Witness Script
          </text>
          <text x="20" y="46" fontSize="11" fill="#6b5d4f">
            The spending conditions hidden behind the P2WSH hash
          </text>

          {/* === WITNESS SCRIPT ELEMENTS === */}
          {/* Background box for the script */}
          <rect
            x="20"
            y="60"
            width="420"
            height="52"
            rx="8"
            fill="#fefdfb"
            stroke="#e8dcc8"
            strokeWidth="1"
          />

          {/* Threshold: 2 */}
          <g
            onMouseEnter={(e) => handleHover("threshold", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
          >
            <rect
              x="30"
              y="68"
              width="32"
              height="36"
              rx="6"
              fill={regionFill("threshold")}
              stroke={regionStroke("threshold")}
              strokeWidth="1.5"
              style={{ cursor: "pointer", transition: "fill 0.15s ease, stroke 0.15s ease" }}
            />
            <text
              x="46"
              y="91"
              fontSize="14"
              fontWeight="700"
              fill="#b8860b"
              textAnchor="middle"
              style={{ pointerEvents: "none" }}
            >
              2
            </text>
          </g>

          {/* Alice's pubkey */}
          <g
            onMouseEnter={(e) => handleHover("alice-pubkey", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
          >
            <rect
              x="72"
              y="68"
              width="150"
              height="36"
              rx="6"
              fill={regionFill("alice-pubkey")}
              stroke={regionStroke("alice-pubkey")}
              strokeWidth="1.5"
              style={{ cursor: "pointer", transition: "fill 0.15s ease, stroke 0.15s ease" }}
            />
            <text
              x="147"
              y="88"
              fontSize="10"
              fill="#b8860b"
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
              style={{ pointerEvents: "none" }}
            >
              &lt;alice_funding_pubkey&gt;
            </text>
          </g>

          {/* Bob's pubkey */}
          <g
            onMouseEnter={(e) => handleHover("bob-pubkey", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
          >
            <rect
              x="232"
              y="68"
              width="140"
              height="36"
              rx="6"
              fill={regionFill("bob-pubkey")}
              stroke={regionStroke("bob-pubkey")}
              strokeWidth="1.5"
              style={{ cursor: "pointer", transition: "fill 0.15s ease, stroke 0.15s ease" }}
            />
            <text
              x="302"
              y="88"
              fontSize="10"
              fill="#b8860b"
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
              style={{ pointerEvents: "none" }}
            >
              &lt;bob_funding_pubkey&gt;
            </text>
          </g>

          {/* Key count: 2 */}
          <g
            onMouseEnter={(e) => handleHover("key-count", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
          >
            <rect
              x="382"
              y="68"
              width="48"
              height="36"
              rx="6"
              fill={regionFill("key-count")}
              stroke={regionStroke("key-count")}
              strokeWidth="1.5"
              style={{ cursor: "pointer", transition: "fill 0.15s ease, stroke 0.15s ease" }}
            />
            <text
              x="406"
              y="91"
              fontSize="14"
              fontWeight="700"
              fill="#b8860b"
              textAnchor="middle"
              style={{ pointerEvents: "none" }}
            >
              2
            </text>
          </g>

          {/* OP_CHECKMULTISIG - right of script box */}
          <g
            onMouseEnter={(e) => handleHover("checkmultisig", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
          >
            <rect
              x="450"
              y="60"
              width="170"
              height="52"
              rx="8"
              fill={regionFill("checkmultisig")}
              stroke={regionStroke("checkmultisig")}
              strokeWidth="1.5"
              style={{ cursor: "pointer", transition: "fill 0.15s ease, stroke 0.15s ease" }}
            />
            <text
              x="535"
              y="90"
              fontSize="12"
              fontWeight="700"
              fill="#b8860b"
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
              style={{ pointerEvents: "none" }}
            >
              OP_CHECKMULTISIG
            </text>
          </g>

          {/* === ARROW: Script → SHA256 === */}
          <defs>
            <marker
              id="vl-ms-arrow"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#6b5d4f" />
            </marker>
          </defs>

          <line
            x1="230"
            y1="112"
            x2="230"
            y2="148"
            stroke="#6b5d4f"
            strokeWidth="1.5"
            markerEnd="url(#vl-ms-arrow)"
          />

          {/* === SHA256 DIAMOND === */}
          <g
            onMouseEnter={(e) => handleHover("sha256", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
          >
            <polygon
              points="230,150 275,180 230,210 185,180"
              fill={hovered === "sha256" ? "rgba(184, 134, 11, 0.08)" : "white"}
              stroke={hovered === "sha256" ? "#b8860b" : "#e8dcc8"}
              strokeWidth={hovered === "sha256" ? 2 : 1.5}
              style={{
                cursor: "pointer",
                transition: "fill 0.15s ease, stroke 0.15s ease",
              }}
            />
            <text
              x="230"
              y="183"
              fontSize="11"
              fontWeight="700"
              fill="#2a1f0d"
              textAnchor="middle"
              style={{ pointerEvents: "none" }}
            >
              SHA256
            </text>
          </g>

          {/* === ARROW: SHA256 → Output Script === */}
          <line
            x1="230"
            y1="210"
            x2="230"
            y2="248"
            stroke="#6b5d4f"
            strokeWidth="1.5"
            markerEnd="url(#vl-ms-arrow)"
          />

          {/* === OUTPUT SCRIPT BOX === */}
          <g
            onMouseEnter={(e) => handleHover("output-script", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
          >
            <rect
              x="80"
              y="250"
              width="300"
              height="48"
              rx="8"
              fill={regionFill("output-script")}
              stroke={regionStroke("output-script")}
              strokeWidth="1.5"
              style={{
                cursor: "pointer",
                transition: "fill 0.15s ease, stroke 0.15s ease",
              }}
            />
            <text
              x="230"
              y="270"
              fontSize="11"
              fontWeight="600"
              fill="#2a1f0d"
              textAnchor="middle"
              style={{ pointerEvents: "none" }}
            >
              Output Script (P2WSH)
            </text>
            <text
              x="230"
              y="289"
              fontSize="11"
              fill="#b8860b"
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
              style={{ pointerEvents: "none" }}
            >
              OP_0 &lt;32-byte script_hash&gt;
            </text>
          </g>

          {/* Right side: explanation */}
          <text
            x="470"
            y="155"
            fontSize="11"
            fill="#6b5d4f"
            fontStyle="italic"
          >
            The witness script is hashed
          </text>
          <text
            x="470"
            y="172"
            fontSize="11"
            fill="#6b5d4f"
            fontStyle="italic"
          >
            and placed in the output.
          </text>
          <text
            x="470"
            y="195"
            fontSize="11"
            fill="#6b5d4f"
            fontStyle="italic"
          >
            To spend, reveal the script
          </text>
          <text
            x="470"
            y="212"
            fontSize="11"
            fill="#6b5d4f"
            fontStyle="italic"
          >
            and provide both signatures.
          </text>
        </svg>

        {/* Tooltip overlay */}
        {hovered && tooltip && (
          <VLTooltip
            title={tooltip.title}
            description={tooltip.description}
            x={Math.min(Math.max(tooltipPos.x, 120), 600)}
            y={tooltipPos.y}
          />
        )}
      </div>
    </div>
  );
}
