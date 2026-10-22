import { describe, expect, it } from "vitest";
import { findCredentialAssignments } from "./credential-assignment.js";

const findingsIn = (text: string) =>
  findCredentialAssignments(text.split("\n")).map(({ kind, firstLine, lastLine }) => ({
    kind,
    firstLine,
    lastLine,
  }));

/** `${name}` without tripping the template-in-string lint. */
const shellTemplate = (name: string) => ["$", "{", name, "}"].join("");

describe("tier 2: credential-assignment must fire (§8.4)", () => {
  it.each([
    "DB_PASSWORD=S3cr3t!Passw0rd",
    'export API_KEY="9fK2mQ7xLp4Rt8Vw"',
    '"client_secret": "Zx81-QpLm-77Hb-ee3R"',
    "password: Hunter2Hunter2",
    "stripeSecretKey = 'a8F3kQ9zLm2X'",
    'token := "q9WvT3kZ8LmN"',
  ])("%s", (line) => {
    expect(findingsIn(line)).toEqual([
      { kind: "credential-assignment", firstLine: 1, lastLine: 1 },
    ]);
  });
});

describe("tier 2: credential-assignment must not fire (§8.4)", () => {
  it.each([
    "password = stored in the keychain",
    "password: required",
    "token: string",
    "password: z.string().min(8)",
    "secret = config.secret",
    "apiKey = process.env.OPENAI_API_KEY",
    `DB_PASSWORD=${shellTemplate("DB_PASSWORD")}`,
    "password=<your-password>",
    "API_KEY=changeme",
    'api_key: "your_api_key_here"',
    "password = ********",
    "max_tokens = 4000",
    "token budget: 4000 tokens",
    "accessToken = refreshedAccessToken",
    "PWD=/home/oscar/code",
    'password_policy: "min 12 chars"',
  ])("%s", (line) => {
    expect(findingsIn(line)).toEqual([]);
  });
});

describe("tier 2: key boundary and placement", () => {
  it("a key must END with a credential word", () => {
    expect(findingsIn("tokenizer = Abc12345xyz")).toEqual([]);
    expect(findingsIn("secretary: Abc12345xyz")).toEqual([]);
    expect(findingsIn("DB_PASSWORD = Abc12345xyz")).toHaveLength(1);
    expect(findingsIn("stripeSecretKey: Abc12345xyz")).toHaveLength(1);
  });

  it("reports the assignment's own line in a multi-line note", () => {
    const note = ["# Deploy", "", "Steps below.", "DB_PASSWORD=S3cr3t!Passw0rd", "done"].join("\n");
    expect(findingsIn(note)).toEqual([
      { kind: "credential-assignment", firstLine: 4, lastLine: 4 },
    ]);
  });

  it("finds an assignment after a separator and before a terminator", () => {
    expect(findingsIn("user=bob,password=Abc12345!;")).toHaveLength(1);
    expect(findingsIn('{ "token": "q9WvT3kZ8LmN" }')).toHaveLength(1);
  });

  it("reads an assignment quoted inside a code string literal", () => {
    expect(findingsIn('  "password: required",')).toEqual([]);
    expect(findingsIn('  "secret = config.secret",')).toEqual([]);
    expect(findingsIn('  const note = "password: Hunter2Hunter2";')).toHaveLength(1);
  });

  it("spans the value's columns", () => {
    const [match] = findCredentialAssignments(["password: Hunter2Hunter2"]);
    expect(match).toMatchObject({ start: 10, end: 24 });
  });
});
