// Tier C' re-check (advances/M4/spike.md): does the official, Zetetic-maintained
// SQLCipher.swift package -- the exact SPM dependency a real iOS app would declare --
// open a vault written by better-sqlite3-multiple-ciphers with PRAGMA legacy=4 set,
// using the raw 32-byte key valija derives? The original run (legacy unset, i.e.
// legacy=0) failed; this re-run tests whether the library's own documented
// SQLCipher-compatibility toggle closes the gap.
//
// Mirrors Tier B's Linux methodology on Apple's own toolchain. Prints one line,
// `RESULT key=<value> ...`, meant to be read from the CI job log -- nothing here is
// asserted by an automated test; a human records the result in spike.md and
// vault-format.md.

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

func report(_ label: String, _ status: String, _ detail: String = "") {
    print("RESULT label=\(label) raw_key_open=\(status)\(detail.isEmpty ? "" : " detail=\(detail)")")
}

func fail(_ label: String, _ detail: String) {
    report(label, "SETUP_ERROR", detail)
}

func check(_ label: String, fixtureDir: String) {
    let manifestPath = fixtureDir + "/manifest.json"
    let vaultDbPath = fixtureDir + "/vault.db"

    guard let manifestData = FileManager.default.contents(atPath: manifestPath) else {
        return fail(label, "cannot read manifest.json at \(manifestPath)")
    }
    guard
        let manifestObj = try? JSONSerialization.jsonObject(with: manifestData),
        let manifest = manifestObj as? [String: Any],
        let keyHex = manifest["keyHex"] as? String
    else {
        return fail(label, "cannot parse manifest.json or missing keyHex")
    }
    guard let keyBytes = hexToBytes(keyHex), keyBytes.count == 32 else {
        return fail(label, "keyHex is not 64 hex chars")
    }

    // Never open the committed fixture in place -- copy to a throwaway path first,
    // the same discipline the format contract (docs/vault-format.md SS11) requires.
    let tmpPath = NSTemporaryDirectory() + "tierc-vault-\(UUID().uuidString).db"
    do {
        try FileManager.default.copyItem(atPath: vaultDbPath, toPath: tmpPath)
    } catch {
        return fail(label, "could not copy fixture: \(error)")
    }
    defer { try? FileManager.default.removeItem(atPath: tmpPath) }

    var db: OpaquePointer?
    guard sqlite3_open(tmpPath, &db) == SQLITE_OK else {
        return fail(label, "sqlite3_open failed")
    }
    defer { sqlite3_close(db) }

    let keyResult = keyBytes.withUnsafeBytes { raw -> Int32 in
        sqlite3_key(db, raw.baseAddress, Int32(raw.count))
    }
    guard keyResult == SQLITE_OK else {
        return report(label, "FAIL", "sqlite3_key returned \(keyResult)")
    }

    var stmt: OpaquePointer?
    let prepareResult = sqlite3_prepare_v2(db, "SELECT count(*) FROM sqlite_master", -1, &stmt, nil)
    guard prepareResult == SQLITE_OK else {
        let msg = String(cString: sqlite3_errmsg(db))
        return report(label, "FAIL", "prepare returned \(prepareResult): \(msg)")
    }

    let stepResult = sqlite3_step(stmt)
    if stepResult == SQLITE_ROW {
        let tableCount = sqlite3_column_int(stmt, 0)
        sqlite3_finalize(stmt)
        report(label, "PASS", "sqlite_master table count = \(tableCount)")
    } else {
        let msg = String(cString: sqlite3_errmsg(db))
        sqlite3_finalize(stmt)
        report(label, "FAIL", "step returned \(stepResult): \(msg)")
    }
}

func printDefaultCipherParams() {
    var db: OpaquePointer?
    guard sqlite3_open(":memory:", &db) == SQLITE_OK else {
        print("RESULT label=defaults raw_key_open=SETUP_ERROR detail=cannot open :memory:")
        return
    }
    defer { sqlite3_close(db) }
    for name in [
        "cipher_default_kdf_iter", "cipher_default_page_size", "cipher_default_use_hmac",
        "cipher_default_plaintext_header_size", "cipher_version",
    ] {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, "PRAGMA \(name)", -1, &stmt, nil) == SQLITE_OK else {
            print("DEFAULT \(name) = <prepare failed>")
            continue
        }
        defer { sqlite3_finalize(stmt) }
        if sqlite3_step(stmt) == SQLITE_ROW {
            if let text = sqlite3_column_text(stmt, 0) {
                print("DEFAULT \(name) = \(String(cString: text))")
            } else {
                print("DEFAULT \(name) = \(sqlite3_column_int(stmt, 0))")
            }
        } else {
            print("DEFAULT \(name) = <no row>")
        }
    }
}

let arguments = CommandLine.arguments
guard arguments.count > 2 else {
    fail("setup", "usage: ValijaTierCSpike <golden-vault-dir> <legacy4-fixture-dir>")
    exit(1)
}

printDefaultCipherParams()
check("legacy0-golden-vault", fixtureDir: arguments[1])
check("legacy4-fixture", fixtureDir: arguments[2])
