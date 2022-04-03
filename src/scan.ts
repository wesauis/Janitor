import { Dirent } from "fs";
import fs from "fs/promises";
import path from "path";

interface ScanTarget {
  type: "dir" | "file";
  matcher: RegExp;
}

interface ScanInfo {
  /** Full path to entry */
  readonly path: string;
  /** Matched Entry */
  readonly entry: Dirent;
  /** All entries in current folder */
  readonly entries: Dirent[];
  /** Remaining Entries */
  remaining: Dirent[];
  /** Next Directories to process */
  next: Dirent[];
}

/**
 * Handle a scan detection
 *
 * @param info mutate to change the scan process
 *
 * @returns - `void`, if `type == dir`, will skip the directory
 *          - `false` lets the next target run
 *          - `true` goes to the next entry
 */
type ScanDetectionHandler = (info: ScanInfo) => void | boolean;

class Scanner {
  public constructor(
    private rootPath: string,
    private targets: [ScanTarget, ScanDetectionHandler][] = []
  ) {}

  protected parse(
    type: ScanTarget["type"],
    target: "*" | string | RegExp
  ): ScanTarget {
    let matcher: RegExp | null = /./;

    if (typeof target == "string") {
      if (target != "*") {
        matcher = new RegExp(`^${target}$`);
      }
    } else if (target instanceof RegExp) {
      matcher = target;
    }

    return { type, matcher };
  }

  public target(target: ScanTarget, handler: ScanDetectionHandler): Scanner {
    this.targets.push([target, handler]);
    return this;
  }

  public dir(
    target: "*" | string | RegExp,
    handler: ScanDetectionHandler
  ): Scanner {
    this.target(this.parse("dir", target), handler);
    return this;
  }

  public file(
    target: "*" | string | RegExp,
    handler: ScanDetectionHandler
  ): Scanner {
    this.target(this.parse("file", target), handler);
    return this;
  }

  public async scan() {
    try {
      const entries = await fs.readdir(this.rootPath, { withFileTypes: true });

      let remaining = [...entries];
      remaining.sort((a, b) => (a.isFile() ? -1 : +1) + (b.isFile() ? -1 : +1));

      let next: Dirent[] = [];

      while (remaining.length) {
        const entry = remaining.shift();
        const isFile = entry.isFile();
        const isDir = entry.isDirectory();

        const type: ScanTarget["type"] = isFile ? "file" : isDir ? "dir" : null;
        if (type == null) continue;

        if (type == "dir") {
          next.push(entry);
        }

        const fullPath = path.resolve(this.rootPath, entry.name);

        for (const [target, handle] of this.targets) {
          let mustBreak = false;
          let info: ScanInfo = {
            path: fullPath,
            entry,
            entries,
            next,
            remaining,
          };

          if (target.type == type && target.matcher.test(entry.name)) {
            const result = handle(info);

            if (result == null) {
              if (type == "dir") {
                next.pop();
              }

              mustBreak = true;
            } else {
              mustBreak = result as boolean;
            }
          }

          remaining = info.remaining;
          next = info.next;

          if (mustBreak) break;
        }
      }

      const scans: Promise<void>[] = [];
      for (const dir of next) {
        const scanner = new Scanner(
          path.resolve(this.rootPath, dir.name),
          this.targets
        );

        scans.push(scanner.scan());
      }

      await Promise.all(scans);
    } catch (err) {
      console.error(err.code, this.rootPath);
    }
  }
}

export default function createScanner(rootPath: string) {
  return new Scanner(path.resolve(rootPath));
}
