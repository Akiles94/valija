import type { Container } from "../../../../src/delivery/container.js";

/**
 * A `Container` that throws on any access. `buildProgram` and `buildMcpServer` only read the
 * container inside actions and handlers, so introspection succeeds while no adapter (vault,
 * keychain, state folder) is ever constructed (P-D2).
 */
export function createInertContainer(onTouch?: (key: string) => void): Container {
  return new Proxy(
    {},
    {
      get(_target, key) {
        onTouch?.(String(key));
        throw new Error(`living-docs never runs use cases (touched "${String(key)}")`);
      },
    },
  ) as Container;
}
