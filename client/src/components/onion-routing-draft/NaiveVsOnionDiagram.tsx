// ────────────────────────────────────────────────────────────────────────────
// NaiveVsOnionDiagram
//
// Side-by-side: a "plaintext header" packet that leaks the entire route to
// every forwarder, vs. an onion-routed packet that exposes only the current
// hop's slice. Used in Chapter 1 to make the privacy leak concrete.
// ────────────────────────────────────────────────────────────────────────────

const ROUTE = ["Alice", "Bob", "Charlie", "Dave"];

function PlaintextPanel() {
  return (
    <div
      className="flex-1 border-2 border-rose-400/80 bg-rose-50 dark:bg-rose-900/20 p-4"
      data-testid="onion-naive-panel"
    >
      <div className="font-pixel text-xs uppercase tracking-wider text-rose-700 dark:text-rose-300 mb-3">
        Naive: plaintext header
      </div>
      <div className="text-sm mb-3 leading-relaxed">
        Bob receives a packet containing the whole route, in the clear:
      </div>
      <div
        className="bg-white dark:bg-slate-900 border-2 border-rose-300 dark:border-rose-700 p-3 text-xs leading-relaxed"
        style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
      >
        <div>sender:&nbsp;&nbsp;Alice</div>
        <div>hop 1:&nbsp;&nbsp;&nbsp;Bob (10,003 sats, block 260)</div>
        <div>hop 2:&nbsp;&nbsp;&nbsp;Charlie (10,002 sats, block 180)</div>
        <div>hop 3:&nbsp;&nbsp;&nbsp;Dave (10,000 sats, block 140)</div>
      </div>
      <div className="mt-3 text-sm leading-snug">
        <div className="font-semibold text-rose-700 dark:text-rose-300 mb-1">
          What Bob learns:
        </div>
        <ul className="list-disc pl-5 space-y-0.5 text-foreground/80">
          <li>Alice initiated the payment</li>
          <li>Dave is the final destination</li>
          <li>The full route and every hop's fee</li>
        </ul>
      </div>
    </div>
  );
}

function OnionPanel() {
  return (
    <div
      className="flex-1 border-2 border-emerald-400/80 bg-emerald-50 dark:bg-emerald-900/20 p-4"
      data-testid="onion-routed-panel"
    >
      <div className="font-pixel text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-3">
        Onion routed
      </div>
      <div className="text-sm mb-3 leading-relaxed">
        Bob receives a fixed-size onion. He can only open his own layer:
      </div>
      <div
        className="bg-white dark:bg-slate-900 border-2 border-emerald-300 dark:border-emerald-700 p-3 text-xs leading-relaxed"
        style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
      >
        <div className="text-emerald-700 dark:text-emerald-300">[bob's layer, readable]</div>
        <div className="ml-2">forward 10,002 sats to Charlie</div>
        <div className="ml-2">outgoing CLTV: block 180</div>
        <div className="mt-2 text-foreground/40">[charlie's layer, encrypted, only Charlie can open]</div>
        <div className="text-foreground/40">[dave's layer, encrypted, only Dave can open]</div>
        <div className="text-foreground/40">[padding to 1366 bytes total]</div>
      </div>
      <div className="mt-3 text-sm leading-snug">
        <div className="font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
          What Bob learns:
        </div>
        <ul className="list-disc pl-5 space-y-0.5 text-foreground/80">
          <li>The next hop is Charlie</li>
          <li>How much to forward and the CLTV</li>
          <li>Nothing else</li>
        </ul>
      </div>
    </div>
  );
}

export function NaiveVsOnionDiagram() {
  return (
    <div className="my-8" data-testid="onion-naive-vs-onion">
      <div className="flex flex-col md:flex-row gap-4">
        <PlaintextPanel />
        <OnionPanel />
      </div>
    </div>
  );
}

export default NaiveVsOnionDiagram;
