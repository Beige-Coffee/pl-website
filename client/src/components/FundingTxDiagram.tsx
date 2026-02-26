import { useState, useRef, useCallback } from "react";

interface FundingTxDiagramProps {
  theme: "light" | "dark";
}

type HoverRegion =
  | "transaction"
  | "input-txid"
  | "input-scriptsig"
  | "output-value"
  | "output-scriptpubkey"
  | "witness-script"
  | "sha256"
  | "witness"
  | null;

const TOOLTIPS: Record<Exclude<HoverRegion, null>, { title: string; code: string; note?: string }> = {
  transaction: {
    title: "FULL TRANSACTION",
    code: `CMutableTransaction([<inputs>], [<outputs>])`,
    note: "Assemble inputs and outputs into a complete transaction",
  },
  "input-txid": {
    title: "TRANSACTION INPUT",
    code: `COutPoint(<txid_bytes>, <output_index>)\nCTxIn(<outpoint>)`,
    note: "Wrap the txid and vout in an outpoint, then create an input from it",
  },
  "input-scriptsig": {
    title: "SCRIPTSIG",
    code: `# Empty for SegWit transactions\n# Signature data goes in the witness instead`,
  },
  "output-value": {
    title: "OUTPUT VALUE",
    code: `CTxOut(<amount_in_satoshis>, <locking_script>)`,
    note: "Create an output that locks the funding amount to the script",
  },
  "output-scriptpubkey": {
    title: "P2WSH OUTPUT",
    code: `CScript([OP_0, <32_byte_script_hash>])`,
    note: "A P2WSH output is OP_0 followed by the SHA256 of the witness script",
  },
  "witness-script": {
    title: "WITNESS SCRIPT",
    code: `CScript([\n    <threshold>,\n    <pubkey_1>,\n    <pubkey_2>,\n    <key_count>,\n    <multisig_opcode>\n])`,
    note: "This is the 2-of-2 multisig from the previous exercise",
  },
  sha256: {
    title: "SHA256 HASH",
    code: `hashlib.sha256(<witness_script>).digest()`,
    note: "Hash the witness script to get the 32 bytes for the P2WSH output",
  },
  witness: {
    title: "WITNESS DATA",
    code: `# Added later when the transaction is signed\n# Left empty for now`,
  },
};

// Syntax colors matching CodeMirror's defaultHighlightStyle (light) and oneDark (dark)
const SYNTAX_COLORS = {
  light: { keyword: "#708", string: "#a11", number: "#164", constant: "#164", funcCall: "#00f", text: "#1e293b", comment: "#940" },
  dark:  { keyword: "#c678dd", string: "#98c379", number: "#d19a66", constant: "#d19a66", funcCall: "#61afef", text: "#abb2bf", comment: "#7d8799" },
};

function highlightPython(line: string, dark: boolean): React.ReactNode[] {
  const c = dark ? SYNTAX_COLORS.dark : SYNTAX_COLORS.light;
  const parts: React.ReactNode[] = [];
  const commentIdx = line.indexOf("#");
  const codePart = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
  const commentPart = commentIdx >= 0 ? line.slice(commentIdx) : "";

  const tokenRegex = /(\b(?:import|from|def|return|class|if|else|for|in|True|False|None)\b)|("[^"]*"|'[^']*')|(\b\d+\b)|([A-Z_][A-Z_0-9]+(?=\b))|(\w+(?=\s*\())|([()[\],=.])|(\w+)/g;
  let match;
  let lastIndex = 0;

  while ((match = tokenRegex.exec(codePart)) !== null) {
    if (match.index > lastIndex) {
      parts.push(codePart.slice(lastIndex, match.index));
    }
    const [text, keyword, str, num, constant, funcCall] = match;
    if (keyword) {
      parts.push(<span key={match.index} style={{ color: c.keyword }}>{text}</span>);
    } else if (str) {
      parts.push(<span key={match.index} style={{ color: c.string }}>{text}</span>);
    } else if (num) {
      parts.push(<span key={match.index} style={{ color: c.number }}>{text}</span>);
    } else if (constant) {
      parts.push(<span key={match.index} style={{ color: c.constant }}>{text}</span>);
    } else if (funcCall) {
      parts.push(<span key={match.index} style={{ color: c.funcCall }}>{text}</span>);
    } else {
      parts.push(<span key={match.index} style={{ color: c.text }}>{text}</span>);
    }
    lastIndex = match.index + text.length;
  }
  if (lastIndex < codePart.length) {
    parts.push(codePart.slice(lastIndex));
  }
  if (commentPart) {
    parts.push(<span key="comment" style={{ color: c.comment, fontStyle: "italic" }}>{commentPart}</span>);
  }
  return parts;
}

export default function FundingTxDiagram({ theme }: FundingTxDiagramProps) {
  const [hovered, setHovered] = useState<HoverRegion>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const isDark = theme === "dark";
  const gold = isDark ? "#FFD700" : "#7a5600";
  const bg = isDark ? "#0b1220" : "#fdf9f2";
  const cardBg = isDark ? "#0f1930" : "#ffffff";
  const borderColor = isDark ? "#2a3552" : "#d4c9a8";
  const sectionBorder = isDark ? "#3a4a6b" : "#c4b99a";
  const sectionBg = isDark ? "rgba(11, 18, 32, 0.6)" : "rgba(245, 240, 232, 0.6)";
  const textColor = isDark ? "#e2e8f0" : "#111111";
  const mutedText = isDark ? "#94a3b8" : "#1a1a1a";
  const hoverFill = isDark ? "rgba(255, 215, 0, 0.15)" : "rgba(184, 134, 11, 0.10)";
  const labelBg = isDark ? "#0a0f1a" : "#f5f0e8";

  const handleHover = useCallback(
    (region: HoverRegion, e: React.MouseEvent<SVGGElement>) => {
      setHovered(region);
      if (region && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setTooltipPos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    },
    [],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGGElement>) => {
      if (hovered && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setTooltipPos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    },
    [hovered],
  );

  const regionStyle = (region: HoverRegion) => ({
    fill: hovered === region ? hoverFill : "transparent",
    cursor: "pointer",
    transition: "fill 0.15s ease",
  });

  const tooltip = hovered ? TOOLTIPS[hovered] : null;

  return (
    <div ref={containerRef} className="relative my-6 select-none" style={{ maxWidth: 820 }}>
      <svg
        viewBox="0 0 680 360"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "auto", fontFamily: "system-ui, sans-serif" }}
      >
        {/* Background */}
        <rect x="0" y="0" width="680" height="360" rx="8" fill={bg} stroke={borderColor} strokeWidth="1.5" />

        {/* === TRANSACTION CARD (full area = CMutableTransaction hover) === */}
        <g
          onMouseEnter={(e) => handleHover("transaction", e)}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
        >
          <rect x="20" y="15" width="320" height="330" rx="6" fill={cardBg} stroke={hovered === "transaction" ? gold : borderColor} strokeWidth={hovered === "transaction" ? 2.5 : 2} style={{ cursor: "pointer", transition: "stroke 0.15s ease" }} />
          <text x="35" y="38" fontSize="13" fontWeight="700" fill={textColor}>
            TXID:
          </text>
          <text x="75" y="38" fontSize="12" fontWeight="500" fill={mutedText} fontFamily="monospace">
            AliceBobFunding1
          </text>

          {/* === INPUTS SECTION BOX === */}
          <rect x="30" y="48" width="300" height="110" rx="4" fill={sectionBg} stroke={sectionBorder} strokeWidth="1.5" />
          <text x="40" y="66" fontSize="12" fontWeight="700" fill={textColor}>
            Inputs
          </text>
          <line x1="40" y1="71" x2="320" y2="71" stroke={sectionBorder} strokeWidth="0.5" />

          {/* Input 0: txid + index (hoverable) */}
          <g
            onMouseEnter={(e) => { e.stopPropagation(); handleHover("input-txid", e); }}
            onMouseMove={handleMouseMove}
            onMouseLeave={(e) => { e.stopPropagation(); handleHover("transaction", e); }}
          >
            <rect x="38" y="76" width="284" height="48" rx="4" style={regionStyle("input-txid")} stroke={hovered === "input-txid" ? gold : "transparent"} strokeWidth="1.5" />
            <text x="48" y="93" fontSize="11" fill={mutedText}>
              0:
            </text>
            <text x="72" y="93" fontSize="11" fill={textColor}>
              txid:
            </text>
            <rect x="130" y="80" width="170" height="18" rx="3" fill={labelBg} stroke={borderColor} strokeWidth="0.5" />
            <text x="140" y="93" fontSize="11" fill={gold} fontFamily="monospace">
              AliceTx1
            </text>
            <text x="72" y="114" fontSize="11" fill={textColor}>
              index:
            </text>
            <rect x="130" y="100" width="55" height="18" rx="3" fill={labelBg} stroke={borderColor} strokeWidth="0.5" />
            <text x="140" y="113" fontSize="11" fill={gold} fontFamily="monospace">
              0
            </text>
          </g>

          {/* Input 0: scriptSig (hoverable) */}
          <g
            onMouseEnter={(e) => { e.stopPropagation(); handleHover("input-scriptsig", e); }}
            onMouseMove={handleMouseMove}
            onMouseLeave={(e) => { e.stopPropagation(); handleHover("transaction", e); }}
          >
            <rect x="38" y="128" width="284" height="22" rx="4" style={regionStyle("input-scriptsig")} stroke={hovered === "input-scriptsig" ? gold : "transparent"} strokeWidth="1.5" />
            <text x="72" y="143" fontSize="11" fill={textColor}>
              scriptSig:
            </text>
            <text x="148" y="143" fontSize="10" fontStyle="italic" fill={mutedText}>
              (empty for SegWit)
            </text>
          </g>

          {/* === OUTPUTS SECTION BOX === */}
          <rect x="30" y="162" width="300" height="80" rx="4" fill={sectionBg} stroke={sectionBorder} strokeWidth="1.5" />
          <text x="40" y="180" fontSize="12" fontWeight="700" fill={textColor}>
            Outputs
          </text>
          <line x1="40" y1="185" x2="320" y2="185" stroke={sectionBorder} strokeWidth="0.5" />

          {/* Output 0: value (hoverable) */}
          <g
            onMouseEnter={(e) => { e.stopPropagation(); handleHover("output-value", e); }}
            onMouseMove={handleMouseMove}
            onMouseLeave={(e) => { e.stopPropagation(); handleHover("transaction", e); }}
          >
            <rect x="38" y="190" width="284" height="22" rx="4" style={regionStyle("output-value")} stroke={hovered === "output-value" ? gold : "transparent"} strokeWidth="1.5" />
            <text x="48" y="206" fontSize="11" fill={mutedText}>
              0:
            </text>
            <text x="72" y="206" fontSize="11" fill={textColor}>
              value:
            </text>
            <rect x="130" y="193" width="120" height="18" rx="3" fill={labelBg} stroke={borderColor} strokeWidth="0.5" />
            <text x="140" y="206" fontSize="11" fill={gold} fontFamily="monospace">
              5,000,000
            </text>
          </g>

          {/* Output 0: scriptPubKey (hoverable) */}
          <g
            onMouseEnter={(e) => { e.stopPropagation(); handleHover("output-scriptpubkey", e); }}
            onMouseMove={handleMouseMove}
            onMouseLeave={(e) => { e.stopPropagation(); handleHover("transaction", e); }}
          >
            <rect x="38" y="214" width="284" height="22" rx="4" style={regionStyle("output-scriptpubkey")} stroke={hovered === "output-scriptpubkey" ? gold : "transparent"} strokeWidth="1.5" />
            <text x="72" y="230" fontSize="11" fill={textColor}>
              scriptPubKey:
            </text>
            <text x="158" y="230" fontSize="10" fill={gold} fontFamily="monospace">
              OP_0 &lt;script_hash&gt;
            </text>
          </g>

          {/* === WITNESS SECTION BOX === */}
          <rect x="30" y="248" width="300" height="52" rx="4" fill={sectionBg} stroke={sectionBorder} strokeWidth="1.5" />
          <text x="40" y="268" fontSize="12" fontWeight="700" fill={textColor}>
            Witness
          </text>
          <line x1="40" y1="273" x2="320" y2="273" stroke={sectionBorder} strokeWidth="0.5" />

          {/* Witness (hoverable) */}
          <g
            onMouseEnter={(e) => { e.stopPropagation(); handleHover("witness", e); }}
            onMouseMove={handleMouseMove}
            onMouseLeave={(e) => { e.stopPropagation(); handleHover("transaction", e); }}
          >
            <rect x="38" y="278" width="284" height="18" rx="4" style={regionStyle("witness")} stroke={hovered === "witness" ? gold : "transparent"} strokeWidth="1.5" />
            <text x="72" y="292" fontSize="10" fontStyle="italic" fill={mutedText}>
              (added later when signing)
            </text>
          </g>
        </g>

        {/* === WITNESS SCRIPT BOX === */}
        <g
          onMouseEnter={(e) => handleHover("witness-script", e)}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
        >
          <rect x="400" y="20" width="255" height="120" rx="6" fill={cardBg} stroke={hovered === "witness-script" ? gold : borderColor} strokeWidth={hovered === "witness-script" ? 2.5 : 2} style={{ transition: "stroke 0.15s ease" }} />
          <text x="415" y="42" fontSize="12" fontWeight="700" fill={textColor}>
            Witness Script
          </text>
          <line x1="415" y1="48" x2="640" y2="48" stroke={borderColor} strokeWidth="0.5" />
          <text x="430" y="68" fontSize="12" fill={gold} fontFamily="monospace">
            2
          </text>
          <text x="430" y="85" fontSize="11" fill={gold} fontFamily="monospace">
            &lt;alice_funding_pubkey&gt;
          </text>
          <text x="430" y="102" fontSize="11" fill={gold} fontFamily="monospace">
            &lt;bob_funding_pubkey&gt;
          </text>
          <text x="430" y="119" fontSize="12" fill={gold} fontFamily="monospace">
            2 OP_CHECKMULTISIG
          </text>
        </g>

        {/* === ARROW: Witness Script -> SHA256 diamond === */}
        <line x1="527" y1="140" x2="527" y2="185" stroke={mutedText} strokeWidth="1.5" markerEnd="url(#arrowhead)" />

        {/* === SHA256 DIAMOND === */}
        <g
          onMouseEnter={(e) => handleHover("sha256", e)}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
        >
          <polygon
            points="527,188 565,213 527,238 489,213"
            fill={hovered === "sha256" ? hoverFill : cardBg}
            stroke={hovered === "sha256" ? gold : borderColor}
            strokeWidth={hovered === "sha256" ? 2.5 : 2}
            style={{ cursor: "pointer", transition: "fill 0.15s ease, stroke 0.15s ease" }}
          />
          <text x="527" y="216" fontSize="10" fontWeight="600" fill={textColor} textAnchor="middle">
            SHA256
          </text>
        </g>

        {/* === ARROW: SHA256 -> Output Script box === */}
        <line x1="527" y1="238" x2="527" y2="268" stroke={mutedText} strokeWidth="1.5" markerEnd="url(#arrowhead)" />

        {/* === OUTPUT SCRIPT BOX === */}
        <g
          onMouseEnter={(e) => handleHover("output-scriptpubkey", e)}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
        >
          <rect x="400" y="270" width="255" height="60" rx="6" fill={cardBg} stroke={hovered === "output-scriptpubkey" ? gold : borderColor} strokeWidth={hovered === "output-scriptpubkey" ? 2.5 : 2} style={{ transition: "stroke 0.15s ease" }} />
          <text x="415" y="292" fontSize="12" fontWeight="700" fill={textColor}>
            Output Script
          </text>
          <line x1="415" y1="298" x2="640" y2="298" stroke={borderColor} strokeWidth="0.5" />
          <text x="430" y="318" fontSize="12" fill={gold} fontFamily="monospace">
            OP_0 &lt;script hash&gt;
          </text>
        </g>

        {/* === CONNECTING ARROW: Output scriptPubKey -> Output Script box === */}
        <path
          d={`M 322 225 L 360 225 L 360 300 L 400 300`}
          fill="none"
          stroke={mutedText}
          strokeWidth="1.5"
          strokeDasharray="4 3"
          markerEnd="url(#arrowhead)"
        />

        {/* Arrowhead marker */}
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={mutedText} />
          </marker>
        </defs>
      </svg>

      {/* Tooltip - positioned above cursor, PL style */}
      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: Math.min(Math.max(tooltipPos.x, 160), 660),
            top: tooltipPos.y - 16,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div
            style={{
              border: `2px solid ${gold}`,
              borderRadius: 4,
              overflow: "hidden",
              backgroundColor: isDark ? "#0f1930" : "#fff",
              boxShadow: isDark
                ? `3px 3px 0 rgba(255, 215, 0, 0.15), 0 4px 20px rgba(0, 0, 0, 0.5)`
                : `3px 3px 0 rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.12)`,
              minWidth: 260,
              maxWidth: 380,
            }}
          >
            {/* Header bar */}
            <div
              style={{
                backgroundColor: isDark ? "#0b1220" : "#f5f0e8",
                borderBottom: `1px solid ${isDark ? "#2a3552" : "#d4c9a8"}`,
                padding: "8px 14px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ color: gold, fontSize: 11, letterSpacing: 1, fontFamily: "'Press Start 2P', monospace" }}>
                {tooltip.title}
              </span>
            </div>

            {/* Code block - matches CodeMirror editor theme */}
            <div
              style={{
                backgroundColor: isDark ? "#0a0f1a" : "#fdf9f2",
                padding: "12px 16px",
                borderBottom: tooltip.note ? `1px solid ${isDark ? "#2a3552" : "#d4c9a8"}` : undefined,
              }}
            >
              <pre
                style={{
                  margin: 0,
                  fontSize: 14,
                  lineHeight: 1.7,
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                  color: isDark ? "#abb2bf" : "#1e293b",
                }}
              >
                {tooltip.code.split("\n").map((line, i) => (
                  <div key={i}>{highlightPython(line, isDark)}</div>
                ))}
              </pre>
            </div>

            {/* Note footer */}
            {tooltip.note && (
              <div
                style={{
                  padding: "8px 14px",
                  fontSize: 13,
                  color: isDark ? "#94a3b8" : "#4a4a4a",
                  backgroundColor: isDark ? "#0b1220" : "#f5f0e8",
                }}
              >
                {tooltip.note}
              </div>
            )}
          </div>

          {/* Arrow pointing down */}
          <div
            style={{
              width: 0,
              height: 0,
              margin: "0 auto",
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderTop: `8px solid ${gold}`,
            }}
          />
        </div>
      )}
    </div>
  );
}
