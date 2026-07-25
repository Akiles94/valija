import type { Database } from "better-sqlite3-multiple-ciphers";
import type { Clock, IdGenerator } from "../../shared/application/ports/clock.js";
import type { LineageStore } from "../application/ports/lineage-store.js";
import type { LineageStamp } from "../domain/services/vault-lineage.js";
import { type DeviceId, parseDeviceId } from "../domain/values/device-id.js";
import { GENERATION_ZERO, nextGeneration, parseGeneration } from "../domain/values/generation.js";
import { createWriteStamp, parseWriteStamp } from "../domain/values/write-stamp.js";

const KEY_GENERATION = "lineage_generation";
const KEY_STAMP = "lineage_stamp";
const KEY_WRITER = "lineage_writer";
const KEY_WRITTEN_AT = "lineage_written_at";

/** Stores the lineage stamp as four rows in the shared, encrypted `meta` table. */
export class SqliteLineageStore implements LineageStore {
  constructor(
    private readonly db: Database,
    private readonly idGen: IdGenerator,
    private readonly clock: Clock,
  ) {}

  read(): LineageStamp | null {
    const generationRaw = this.get(KEY_GENERATION);
    const stampRaw = this.get(KEY_STAMP);
    const writerRaw = this.get(KEY_WRITER);
    const writtenAt = this.get(KEY_WRITTEN_AT);
    if (generationRaw === null || stampRaw === null || writerRaw === null || writtenAt === null) {
      return null;
    }

    const generation = parseGeneration(generationRaw);
    const writeStamp = parseWriteStamp(stampRaw);
    const writer = parseDeviceId(writerRaw);
    if (!generation.ok || !writeStamp.ok || !writer.ok) return null;

    return {
      generation: generation.value,
      writeStamp: writeStamp.value,
      writer: writer.value,
      writtenAt,
    };
  }

  /** Caller runs this inside its own write transaction so the bump commits or rolls back with it. */
  bump(writer: DeviceId): LineageStamp {
    const current = this.read();
    const generation = current === null ? GENERATION_ZERO : nextGeneration(current.generation);
    const writeStamp = createWriteStamp(this.idGen);
    const writtenAt = this.clock.now().toISOString();

    this.set(KEY_GENERATION, String(generation));
    this.set(KEY_STAMP, writeStamp);
    this.set(KEY_WRITER, writer);
    this.set(KEY_WRITTEN_AT, writtenAt);

    return { generation, writeStamp, writer, writtenAt };
  }

  private get(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row ? row.value : null;
  }

  private set(key: string, value: string): void {
    this.db
      .prepare(
        "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(key, value);
  }
}
