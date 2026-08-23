import { useState } from "react";
import type { SpikeResult } from "../main/spike/spike-handlers.js";

declare global {
  interface Window {
    spike: {
      loadSqlcipher: () => Promise<SpikeResult>;
      keychainRoundTrip: () => Promise<SpikeResult>;
      openGoldenVault: () => Promise<SpikeResult>;
    };
  }
}

type Row = { label: string; run: () => Promise<SpikeResult>; result?: SpikeResult };

export function Spike() {
  const [rows, setRows] = useState<Row[]>([
    { label: "Load SQLCipher", run: () => window.spike.loadSqlcipher() },
    { label: "Keychain round-trip", run: () => window.spike.keychainRoundTrip() },
    { label: "Open the golden vault", run: () => window.spike.openGoldenVault() },
  ]);

  async function runOne(index: number) {
    const target = rows[index];
    if (!target) return;
    const result = await target.run();
    setRows((current) => current.map((row, i) => (i === index ? { ...row, result } : row)));
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: 24 }}>
      <h1>Valija — Slice 1 platform spike</h1>
      <p>Throwaway window. Deleted at the end of Slice 1.</p>
      {rows.map((row, index) => (
        <div key={row.label} style={{ marginBottom: 12 }}>
          <button type="button" onClick={() => runOne(index)}>
            {row.label}
          </button>
          {row.result && (
            <span
              style={{
                marginLeft: 12,
                color: row.result.ok ? "green" : "crimson",
              }}
            >
              {row.result.ok ? "PASS" : "FAIL"} — {row.result.detail}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
