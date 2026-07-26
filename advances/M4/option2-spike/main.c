// Option 2 sanity check: does the LITERAL amalgamation source
// (node_modules/better-sqlite3-multiple-ciphers/deps/sqlite3/sqlite3.c --
// the exact file node-gyp compiles into the desktop native addon) open
// valija's real golden vault fixture when compiled standalone with a
// plain C compiler, instead of via node-gyp + the N-API wrapper?
//
// Mirrors valija's actual openVaultDb() (src/shared/infra/sqlite.ts):
// PRAGMA cipher='sqlcipher'; PRAGMA key = "x'<hex>'"; -- legacy is NOT
// set, i.e. legacy=0, the real production config.

#include <stdio.h>
#include <string.h>
#include "sqlite3.h"

static const char *KEY_HEX =
    "3e53d9f1d53beb152abeab88320e77a4fd9e5e878828a1c1aec4d0327d46dc67";

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "usage: %s <path-to-vault.db-copy>\n", argv[0]);
        return 1;
    }
    const char *path = argv[1];

    sqlite3 *db = NULL;
    int rc = sqlite3_open(path, &db);
    if (rc != SQLITE_OK) {
        printf("RESULT open=FAIL rc=%d\n", rc);
        return 1;
    }

    char *errmsg = NULL;
    rc = sqlite3_exec(db, "PRAGMA cipher='sqlcipher';", NULL, NULL, &errmsg);
    if (rc != SQLITE_OK) {
        printf("RESULT cipher_pragma=FAIL rc=%d msg=%s\n", rc, errmsg ? errmsg : "?");
        return 1;
    }

    char keyPragma[128];
    snprintf(keyPragma, sizeof(keyPragma), "PRAGMA key = \"x'%s'\";", KEY_HEX);
    rc = sqlite3_exec(db, keyPragma, NULL, NULL, &errmsg);
    if (rc != SQLITE_OK) {
        printf("RESULT key_pragma=FAIL rc=%d msg=%s\n", rc, errmsg ? errmsg : "?");
        return 1;
    }

    sqlite3_stmt *stmt = NULL;
    rc = sqlite3_prepare_v2(db, "SELECT count(*) FROM sqlite_master", -1, &stmt, NULL);
    if (rc != SQLITE_OK) {
        printf("RESULT raw_key_open=FAIL detail=prepare returned %d: %s\n", rc, sqlite3_errmsg(db));
        return 0;
    }
    rc = sqlite3_step(stmt);
    if (rc == SQLITE_ROW) {
        int tableCount = sqlite3_column_int(stmt, 0);
        sqlite3_finalize(stmt);

        // Go further than "it opens" -- read real rows and print a
        // fingerprint, so a lucky all-zero decrypt can't masquerade as PASS.
        sqlite3_stmt *stmt2 = NULL;
        rc = sqlite3_prepare_v2(
            db,
            "SELECT type, count(*) FROM context_items GROUP BY type ORDER BY type",
            -1, &stmt2, NULL);
        if (rc == SQLITE_OK) {
            printf("RESULT raw_key_open=PASS sqlite_master_count=%d\n", tableCount);
            while (sqlite3_step(stmt2) == SQLITE_ROW) {
                printf("  ROW type=%s count=%d\n",
                       sqlite3_column_text(stmt2, 0), sqlite3_column_int(stmt2, 1));
            }
            sqlite3_finalize(stmt2);
        } else {
            printf("RESULT raw_key_open=PASS_BUT_NO_DATA sqlite_master_count=%d detail=%s\n",
                   tableCount, sqlite3_errmsg(db));
        }
    } else {
        sqlite3_finalize(stmt);
        printf("RESULT raw_key_open=FAIL detail=step returned %d: %s\n", rc, sqlite3_errmsg(db));
    }

    sqlite3_close(db);
    return 0;
}
