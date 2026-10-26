/**
 * Fault-injection child (REKEY Slice 3): runs the REAL `SqliteVaultRekeyer` and prints each stage
 * on its own line, then `DONE <json result>`. Bundled to CJS with tsup at test time and spawned
 * with `NODE_PATH` (F20, P-9). argv: root, current key, new key, writer, and optionally a stage to
 * block at forever so the parent can SIGKILL the process exactly there.
 */
import { writeSync } from "node:fs";
import { ulid } from "ulid";
import { resolveVaultPaths } from "../shared/infra/vault-paths.js";
import { parseDeviceId } from "../vault/domain/values/device-id.js";
import { type RekeyStage, SqliteVaultRekeyer } from "../vault/infra/sqlite-vault-rekeyer.js";

const [root = "", currentKeyHex = "", newKeyHex = "", writerRaw = "", pauseAt] =
  process.argv.slice(2);

const writer = parseDeviceId(writerRaw);
if (!writer.ok) throw new Error("rekey-child: missing writer");

function onStage(stage: RekeyStage): void {
  writeSync(1, `${stage}\n`);
  if (stage === pauseAt) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
}

const rekeyer = new SqliteVaultRekeyer(
  resolveVaultPaths(root),
  { next: () => ulid() },
  { now: () => new Date() },
  onStage,
);
const result = rekeyer.rekey({ currentKeyHex, newKeyHex, writer: writer.value });
const summary = result.ok
  ? { ok: true, generation: result.value.generation, writeStamp: result.value.writeStamp }
  : { ok: false, code: result.error.code, message: result.error.message };
writeSync(1, `DONE ${JSON.stringify(summary)}\n`);
