import createProgram from "./program.js";
import createScanner from "./scan.js";

const $prog = createProgram().parse();

const [rootPath] = $prog.args;

createScanner(rootPath)
  .dir("node_modules", ({ path }) => console.log(path))
  .dir(".dartTool", ({ path }) => console.log(path))
  .file(".pnpm-debug.log", ({ path }) => console.log(path))
  .scan();
