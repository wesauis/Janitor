import { Command } from "commander";
import $package from "../package.json";

export default function createProgram() {
  return new Command()
    .name($package.displayName)
    .description($package.description)
    .version($package.version)
    .argument("<path>", "where to start the search from");
}
