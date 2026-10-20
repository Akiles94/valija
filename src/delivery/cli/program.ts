#!/usr/bin/env node
import { buildContainer } from "../container.js";
import { buildProgram } from "./build-program.js";

buildProgram(buildContainer())
  .parseAsync()
  .catch((error: unknown) => {
    console.error(`error: ${(error as Error).message}`);
    process.exit(1);
  });
