import { IDENTIFY } from "@nestor-home/satellite";
import { describe, expect, it } from "vitest";
import { build, defaultId, MODEL, NAME, parse, UsageError } from "../src/cli.js";

const NO_ENV = {};
const URI = "nestor+http://nestor.local:8471/?code=K7QF2M9X";
const quiet = { debug() {}, info() {}, warn() {} };

describe("my-satellite run", () => {
  it("takes the server's address and the enrollment code from a pairing URI", () => {
    const args = parse(["run", "--room", "salon", "--pairing-uri", URI], NO_ENV);
    expect(args).toMatchObject({ core: "http://nestor.local:8471", enrollment: "K7QF2M9X", id: defaultId() });
    expect(args).toHaveProperty("tokenFile", `~/.config/${NAME}/${defaultId()}.json`);
  });

  it("reads the pairing URI from the environment, the way a person configures a headless device", () => {
    const args = parse(["run", "--room", "salon"], { NESTOR_PAIRING_URI: URI });
    expect(args).toMatchObject({ core: "http://nestor.local:8471", enrollment: "K7QF2M9X" });
  });

  it("needs the server's address when no pairing URI gives it", () => {
    expect(() => parse(["run", "--room", "salon"], NO_ENV)).toThrow(UsageError);
    expect(() => parse(["run", "--room", "salon", "--pairing-code", "K7QF-2M9X"], NO_ENV)).toThrow(UsageError);
  });

  it("refuses a malformed enrollment code before anything runs", () => {
    expect(() => parse(["run", "--core", "http://c", "--room", "salon", "--pairing-code", "nope"], NO_ENV)).toThrow(
      UsageError,
    );
  });

  it("declares the light, and says its device code on the speaker to pair", () => {
    const args = parse(["run", "--core", "http://nestor.local:8471", "--room", "salon", "--id", "enceinte"], NO_ENV);
    if (args === "help") throw new Error("expected arguments");
    const satellite = build(args, quiet);
    expect(satellite.manifest.device.id).toBe("enceinte");
    expect(satellite.manifest.device.model).toBe(MODEL);
    expect(satellite.manifest.has(IDENTIFY)).toBe(true);
    expect(satellite.manifest.pairingMethods).toContain("device_code.speech");
  });
});
