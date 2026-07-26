// Tier C compatibility check (advances/M4/spike.md, question C2): can the
// official, Zetetic-maintained SQLCipher.swift package -- the exact SPM
// dependency a real iOS app would declare -- open a vault written by
// better-sqlite3-multiple-ciphers, using the raw 32-byte key valija derives?
//
// Mirrors Tier B's B2 methodology (advances/M4/spike.md) on Apple's own
// toolchain instead of Linux. Prints one line, `RESULT key=<value> ...`,
// meant to be read from the CI job log -- nothing here is asserted by an
// automated test; a human records the result in spike.md and vault-format.md.

import Foundation
import SQLCipher

func hexToBytes(_ hex: String) -> [UInt8]? {
    guard hex.count % 2 == 0 else { return nil }
    var bytes = [UInt8]()
    bytes.reserveCapacity(hex.count / 2)
    var idx = hex.startIndex
    while idx < hex.endIndex {
        let next = hex.index(idx, offsetBy: 2)
        guard let byte = UInt8(hex[idx..<next], radix: 16) else { return nil }
        bytes.append(byte)
        idx = next
    }
    return bytes
}

func report(_ status: String, _ detail: String = "") -> Never {
    print("RESULT raw_key_open=\(status)\(detail.isEmpty ? "" : " detail=\(detail)")")
    exit(status == "SETUP_ERROR" ? 1 : 0)
}

let arguments = CommandLine.arguments
guard arguments.count > 1 else {
    report("SETUP_ERROR", "missing fixture directory argument")
}
let fixtureDir = arguments[1]
let manifestPath = fixtureDir + "/manifest.json"
let vaultDbPath = fixtureDir + "/vault.db"

guard let manifestData = FileManager.default.contents(atPath: manifestPath) else {
    report("SETUP_ERROR", "cannot read manifest.json at \(manifestPath)")
}
guard
    let manifestObj = try? JSONSerialization.jsonObject(with: manifestData),
    let manifest = manifestObj as? [String: Any],
    let keyHex = manifest["keyHex"] as? String
else {
    report("SETUP_ERROR", "cannot parse manifest.json or missing keyHex")
}
guard let keyBytes = hexToBytes(keyHex), keyBytes.count == 32 else {
    report("SETUP_ERROR", "keyHex is not 64 hex chars")
}

// Never open the committed fixture in place -- copy to a throwaway path first,
// the same discipline the format contract (docs/vault-format.md SS11) requires.
let tmpPath = NSTemporaryDirectory() + "tierc-vault-\(UUID().uuidString).db"
do {
    try FileManager.default.copyItem(atPath: vaultDbPath, toPath: tmpPath)
} catch {
    report("SETUP_ERROR", "could not copy fixture: \(error)")
}
defer { try? FileManager.default.removeItem(atPath: tmpPath) }

var db: OpaquePointer?
guard sqlite3_open(tmpPath, &db) == SQLITE_OK else {
    report("SETUP_ERROR", "sqlite3_open failed")
}
defer { sqlite3_close(db) }

let keyResult = keyBytes.withUnsafeBytes { raw -> Int32 in
    sqlite3_key(db, raw.baseAddress, Int32(raw.count))
}
guard keyResult == SQLITE_OK else {
    report("FAIL", "sqlite3_key returned \(keyResult)")
}

var stmt: OpaquePointer?
let prepareResult = sqlite3_prepare_v2(db, "SELECT count(*) FROM sqlite_master", -1, &stmt, nil)
guard prepareResult == SQLITE_OK else {
    let msg = String(cString: sqlite3_errmsg(db))
    report("FAIL", "prepare returned \(prepareResult): \(msg)")
}

let stepResult = sqlite3_step(stmt)
if stepResult == SQLITE_ROW {
    let tableCount = sqlite3_column_int(stmt, 0)
    sqlite3_finalize(stmt)
    report("PASS", "sqlite_master table count = \(tableCount)")
} else {
    let msg = String(cString: sqlite3_errmsg(db))
    sqlite3_finalize(stmt)
    report("FAIL", "step returned \(stepResult): \(msg)")
}
