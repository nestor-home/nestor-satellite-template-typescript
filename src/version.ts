import type { Software } from "@nestor-home/satellite";

// TODO(rename): your package, as published. release-please keeps the version equal to package.json.
const NAME = "my-satellite";
const VERSION = "0.1.1"; // x-release-please-version

/** What this device runs, named in its manifest (`software`). */
export const SOFTWARE: Software = { name: NAME, version: VERSION };
