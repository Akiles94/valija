import { createInterface, type Interface } from "node:readline";

const CTRL_C = String.fromCharCode(0x03);
const BACKSPACE = String.fromCharCode(0x08);
const DEL = String.fromCharCode(0x7f);

// Shared line reader for piped stdin: one chunk can carry several lines,
// so a per-prompt reader would swallow the lines meant for later prompts.
let reader: Interface | undefined;
const bufferedLines: string[] = [];
const waiters: Array<(line: string) => void> = [];

function readPipedLine(): Promise<string> {
  if (reader === undefined) {
    reader = createInterface({ input: process.stdin });
    reader.on("line", (line) => {
      const waiter = waiters.shift();
      if (waiter) waiter(line);
      else bufferedLines.push(line);
      if (waiters.length === 0) reader?.pause();
    });
  }
  const queued = bufferedLines.shift();
  if (queued !== undefined) return Promise.resolve(queued);
  reader.resume();
  return new Promise((resolve) => waiters.push(resolve));
}

function readHiddenTtyLine(): Promise<string> {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    const chars: string[] = [];
    const onData = (buf: Buffer) => {
      for (const c of buf.toString("utf8")) {
        if (c === "\r" || c === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          resolve(chars.join(""));
          return;
        }
        if (c === CTRL_C) {
          stdin.setRawMode(false);
          stdout.write("\n");
          process.exit(130);
        }
        if (c === BACKSPACE || c === DEL) chars.pop();
        else chars.push(c);
      }
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

/** Prompt for a secret. Hides input on a TTY; reads plain lines when piped. */
export function promptHidden(question: string): Promise<string> {
  process.stdout.write(question);
  return process.stdin.isTTY === true ? readHiddenTtyLine() : readPipedLine();
}
