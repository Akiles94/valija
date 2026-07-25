/**
 * Seeds the lineage generation counter for BYO-cloud sync (D-A/D-B/D-G). Only
 * the generation baseline is set here — deliberately NOT the device id or the
 * first write stamp, which are written by the first real write
 * (SqliteLineageStore.bump), keeping this migration static SQL and the shared
 * migration runner free of any runtime device identity (M3 refined spec,
 * Decision D-2). A vault that has never been written to still classifies as
 * a clean fast-forward — SqliteLineageStore.read() returns null until the
 * stamp/writer rows exist too. The journal-mode fold/switch (WAL -> DELETE,
 * D-A) already happened when the db was opened, before this migration runs.
 */
export const MIGRATION_003 = `
INSERT OR IGNORE INTO meta (key, value) VALUES ('lineage_generation', '0');
`;
