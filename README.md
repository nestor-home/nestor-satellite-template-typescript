# Nestor satellite template, TypeScript

A working [Nestor](https://nestorhome.dev) satellite to start your own device from: a microphone,
a speaker and a status light, in Node, on the
[`@nestor-home/satellite`](https://www.npmjs.com/package/@nestor-home/satellite) SDK. It pairs with
a Nestor server, streams audio both ways, shows the assistant's attitude and blinks when a person
looks for it. Its CI runs the server's conformance suite on every change.

The light is printed: replace it with your hardware, and keep the rest.

## Use this template

On GitHub, choose **Use this template**, then **Create a new repository**. Or with the GitHub CLI:

```bash
gh repo create my-satellite --template nestor-home/nestor-satellite-template-typescript --public --clone
cd my-satellite
pnpm install
pnpm build
```

It needs Node 22.12 or later and pnpm. Audio goes through a recorder and a player command:
`arecord` and `aplay` on Linux (`sudo apt install alsa-utils`), SoX's `rec` and `play` on macOS
(`brew install sox`). WebRTC is [`@roamhq/wrtc`](https://github.com/WonderInventions/node-webrtc),
prebuilt for Linux and macOS (x64, arm64) and Windows x64.

## Rename it

Everything to rename is spelled `my-satellite`:

```bash
grep -rn --exclude-dir=node_modules --exclude-dir=dist my-satellite .
```

| What                  | Where                                                   |
| --------------------- | ------------------------------------------------------- |
| Package name, author  | `package.json` (`name`, `author`, `description`)        |
| Command               | `package.json`, `bin`                                   |
| Model id              | `MODEL` in `src/cli.ts`: what your device is, as a slug |
| Token folder, command | `NAME` in `src/cli.ts`                                  |
| Release               | `package-name` in `release-please-config.json`          |

Then `pnpm install` and run the tests.

## Run it against your Nestor

On the Nestor server, make an enrollment code (or in the admin: **Satellites**, then **Add**):

```bash
nestor satellites add --room salon --name "Living room speaker"
```

It prints a pairing URI. On the device:

```bash
pnpm start run --room salon --pairing-uri 'nestor+http://nestor.local:8471/?code=K7QF2M9X'
```

The first run pairs, then keeps its token in `~/.config/my-satellite/<id>.json`; later runs only
need the server's address:

```bash
pnpm start run --core http://nestor.local:8471 --room salon
```

Run like this without a pairing URI, an unpaired device says a 6-digit code on its speaker and logs
it: type it in the admin, or `nestor satellites approve <code>` on the server.
`NESTOR_PAIRING_URI` works instead of `--pairing-uri`; `--input none --output none` runs without a
sound card; `pnpm start run --help` lists the rest. After a change, `pnpm build` again.

## Plug your hardware

Look for `TODO(hardware)`:

- `src/light.ts`: the body. `behavior` (idle, listening, thinking, speaking) and `identify` print;
  drive your LEDs, screen or motors there. Calls must return at once: keep the state and animate
  from a timer of your own.
- `src/cli.ts`, `DEFAULT_INPUT` and `DEFAULT_OUTPUT`: the commands that record and play raw 48 kHz
  16-bit mono PCM (`--input`, `--output` override them). Or write an `AudioSource` / `AudioSink`.
- `src/cli.ts`, `build()`: the manifest. Declare only what the device has.

| Capability                                     | Body method or SDK call                       |
| ---------------------------------------------- | --------------------------------------------- |
| `IDENTIFY` (`device.identify`)                 | `identify()`                                  |
| `EXPRESSION` (`expression.emotion`)            | `expression(expression, intensity)`           |
| `HEAD_MOTION` (`motion.head`)                  | `beat()`                                      |
| `SPEECH_ACTIVITY` (`audio.speech_activity`)    | `satellite.speechActivity(active)`            |
| `PERSON_DETECTION` (`vision.person_detection`) | `satellite.personDetected(count, confidence)` |

A screen shows the device code with `pairing.display`; a keypad takes enrollment codes with
`pairing.accepts` and `satellite.enroll()`. The same SDK runs in a browser tab. See the
[TypeScript SDK](https://nestorhome.dev/docs/sdks/typescript/).

## Test

```bash
pnpm lint && pnpm typecheck && pnpm test
pnpm conformance
```

`pnpm conformance` builds the command and runs the server's
[conformance suite](https://nestorhome.dev/docs/satellites/conformance/) against it, through uvx
([uv](https://docs.astral.sh/uv/) must be installed) at the version in `.nestor-version`: it
launches `my-satellite run --input none --output none` once per scenario and checks pairing,
refused codes, identify, acks, audio and reconnection. CI runs both on every pull request.
`pnpm format` fixes the formatting.

## Release

Pull request titles follow [Conventional Commits](https://www.conventionalcommits.org/)
(`feat: …`, `fix: …`), checked by `pr-title.yml`. From them, release-please keeps a release pull
request open; merging it tags the version and writes the changelog. Set your first version in
`package.json` and `.release-please-manifest.json`.

`release.yml` runs release-please through nestor-home's shared workflow, which only works in
nestor-home. In your repository:

1. In `release.yml`, replace the `release` job with the commented one under it. Under
   **Settings**, **Actions**, **General**, allow GitHub Actions to create pull requests.
2. In `package.json`, remove `"private": true` and add your `repository` (npm checks it against
   the provenance).
3. On npm, publish a first version by hand (`npm publish --access public`), then in the package's
   settings add a [trusted publisher](https://docs.npmjs.com/trusted-publishers): GitHub Actions,
   your repository, workflow `release.yml`, environment `npm`.
4. In your repository, create the environment `npm` (**Settings**, **Environments**), then
   uncomment the `npm` job. No token is stored: npm trusts the workflow.

## Documentation

- [Satellites](https://nestorhome.dev/docs/satellites/): capabilities and pairing.
- [Protocol](https://nestorhome.dev/docs/satellites/protocol/): the standard satellites follow.
- [TypeScript SDK](https://nestorhome.dev/docs/sdks/typescript/): every option of `Satellite`.
- [Conformance](https://nestorhome.dev/docs/satellites/conformance/).

## License

MIT
