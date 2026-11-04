/**
 * `my-satellite run`: this device as a satellite of a Nestor server.
 *
 *     my-satellite run --room salon --pairing-uri "nestor+http://nestor.local:8471/?code=K7QF2M9X"
 *     my-satellite run --core http://nestor.local:8471 --room salon
 *
 * The first run pairs: with the pairing URI or enrollment code it is given (flags, or
 * `NESTOR_PAIRING_URI` / `NESTOR_PAIRING_CODE`), else it says a device code on its speaker and logs
 * it, to type in Nestor. The token is then kept in `~/.config/my-satellite/<id>.json`, and later runs
 * reconnect with it.
 */

import { hostname } from "node:os";
import { parseArgs } from "node:util";
import { IDENTIFY, type Logger, Manifest, ProtocolError, Satellite } from "@nestor-home/satellite";
import {
  type AudioSink,
  type AudioSource,
  CommandSink,
  CommandSource,
  DiscardSink,
  type Environment,
  FileTokenStore,
  languagesFromEnv,
  nodeVoice,
  PAIRING_CODE_ENV,
  PAIRING_URI_ENV,
  readProvisioning,
  SilenceSource,
} from "@nestor-home/satellite/node";
import { Light } from "./light.js";
import { SOFTWARE } from "./version.js";

export const NAME = "my-satellite";
// TODO(rename): what your device is, declared to Nestor (a slug).
export const MODEL = "my-satellite";

// TODO(hardware): the microphone and the speaker, as commands exchanging raw 48 kHz 16-bit mono PCM
// (`arecord`/`aplay` on Linux, SoX's `rec`/`play` on macOS). Or write an AudioSource / AudioSink.
const RATE = 48_000;
const RAW = `-t raw -b 16 -e signed-integer -c 1 -r ${RATE}`;
export const DEFAULT_INPUT =
  process.platform === "darwin" ? `rec -q ${RAW} -` : `arecord -q -t raw -f S16_LE -c 1 -r ${RATE}`;
export const DEFAULT_OUTPUT =
  process.platform === "darwin" ? `play -q ${RAW} -` : `aplay -q -t raw -f S16_LE -c 1 -r ${RATE}`;

const USAGE = `Usage: ${NAME} run --room <room> [options]

Pair this device with a Nestor server if needed, then stay connected.

Options:
  --core <url>          the server's voice address, e.g. http://nestor.local:8471
                        (required unless a pairing URI gives it)
  --room <slug>         the room the device is in: salon, cuisine… (required)
  --pairing-uri <uri>   pair with this pairing URI (default: $${PAIRING_URI_ENV})
  --pairing-code <code> pair with this enrollment code, K7QF-2M9X (default: $${PAIRING_CODE_ENV})
  --id <slug>           this device's id (default: the host name)
  --token-file <path>   where the token is kept (default: ~/.config/${NAME}/<id>.json)
  --input <command>     recorder printing raw 48 kHz s16le mono PCM, or "none" for silence
                        (default: ${DEFAULT_INPUT})
  --output <command>    player reading raw 48 kHz s16le mono PCM, or "none" to drop the audio
                        (default: ${DEFAULT_OUTPUT})
  --locale <tag>        the language it speaks to people: en, fr (default: $LC_ALL, $LANG…)
  -v, --verbose         say what happens
  -h, --help            show this help`;

export interface Arguments {
  readonly core: string;
  readonly room: string;
  readonly id: string;
  readonly tokenFile: string;
  readonly input: string;
  readonly output: string;
  /** The enrollment code a person gave (canonical form), if any. */
  readonly enrollment: string | undefined;
  readonly locale: readonly string[];
  readonly verbose: boolean;
}

export class UsageError extends Error {}

export function defaultId(): string {
  const slug = (hostname().toLowerCase().split(".")[0] ?? "").replace(/[^a-z0-9_-]+/g, "-").replace(/^[-_]+|-+$/g, "");
  return (slug || "satellite").slice(0, 64);
}

/** The arguments of `run`, then the environment; throws a `UsageError` when they are wrong. */
export function parse(argv: readonly string[], env: Environment = process.env): Arguments | "help" {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      core: { type: "string" },
      room: { type: "string" },
      id: { type: "string" },
      "token-file": { type: "string" },
      input: { type: "string" },
      output: { type: "string" },
      "pairing-uri": { type: "string" },
      "pairing-code": { type: "string" },
      locale: { type: "string" },
      verbose: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) return "help";
  if (positionals.length !== 1 || positionals[0] !== "run") throw new UsageError("expected the `run` command");
  const flags = values["pairing-uri"] !== undefined || values["pairing-code"] !== undefined;
  let provisioning: ReturnType<typeof readProvisioning>;
  try {
    provisioning = flags
      ? readProvisioning(values["pairing-uri"], values["pairing-code"])
      : readProvisioning(env[PAIRING_URI_ENV], env[PAIRING_CODE_ENV]);
  } catch (error) {
    throw new UsageError(error instanceof ProtocolError ? error.message : String(error));
  }
  const core = values.core ?? provisioning?.core ?? undefined;
  if (values.room === undefined) throw new UsageError("--room is required");
  if (core === undefined) throw new UsageError("--core is required, unless a pairing URI gives the server's address");
  const id = values.id ?? defaultId();
  return {
    core,
    room: values.room,
    id,
    tokenFile: values["token-file"] ?? `~/.config/${NAME}/${id}.json`,
    input: values.input ?? DEFAULT_INPUT,
    output: values.output ?? DEFAULT_OUTPUT,
    enrollment: provisioning?.enrollment,
    locale: values.locale === undefined ? languagesFromEnv(env) : [values.locale],
    verbose: values.verbose ?? false,
  };
}

export function build(args: Arguments, logger: Logger): Satellite {
  // IDENTIFY is the optional capability this example shows (Light.identify): declare only what the
  // device really has. Audio and text follow from what the satellite is given: `voice` declares the
  // microphone and the speaker, `text.display` the assistant's words. `software` names this package,
  // the one an update would install.
  const manifest = new Manifest({ id: args.id, model: MODEL, room: args.room }, [IDENTIFY], { software: SOFTWARE });
  const source: AudioSource = args.input === "none" ? new SilenceSource(RATE) : new CommandSource(args.input);
  const sink: AudioSink = args.output === "none" ? new DiscardSink(RATE) : new CommandSink(args.output);
  const light = new Light();
  return new Satellite({
    core: args.core,
    manifest,
    tokens: new FileTokenStore(args.tokenFile),
    voice: nodeVoice({ source, sink, logger }),
    // Without a screen, drop `text`: the device then only speaks.
    text: { display: (text, final) => light.show(text, final) },
    // No screen to look at while pairing: the device code is said on the speaker (unless --output
    // none) and logged.
    pairing: { enrollment: args.enrollment },
    body: light,
    locale: args.locale,
    logger,
  });
}

function consoleLogger(verbose: boolean): Logger {
  const say = (message: string) => console.error(`[${NAME}] ${message}`);
  return { debug: verbose ? say : () => {}, info: verbose ? say : () => {}, warn: say };
}

export async function main(argv: readonly string[]): Promise<number> {
  let args: ReturnType<typeof parse>;
  try {
    args = parse(argv);
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
    return 2;
  }
  if (args === "help") {
    console.log(USAGE);
    return 0;
  }
  const satellite = build(args, consoleLogger(args.verbose));
  const stopping = new AbortController();
  const stop = () => stopping.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await satellite.run(stopping.signal);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}
