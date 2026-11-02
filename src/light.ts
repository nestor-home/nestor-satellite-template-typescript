/**
 * The satellite's body: what it does with the core's intents.
 *
 * This one is a status light, printed. Replace the logs with your hardware: an LED ring, a screen,
 * motors. Every method of `Body` is optional; see the others (`expression`, `beat`, `heartbeat`) in
 * the SDK.
 *
 * Calls come from the network loop and must return at once: keep the state here and drive the
 * hardware from a timer or a worker of your own.
 */

import type { Behavior, Body } from "@nestor-home/satellite";

export class Light implements Body {
  behavior(behavior: Behavior): void {
    // TODO(hardware): show the assistant's attitude (idle, listening, thinking, speaking) until the next.
    console.log(`light: ${behavior}`);
  }

  identify(): void {
    // TODO(hardware): blink for a few seconds, so a person tells this device apart from others.
    // It is called while the device waits to be paired, and on `intent.identify` once paired.
    console.log("light: blink");
  }

  show(text: string, _final: boolean): void {
    // TODO(hardware): the assistant's words, one message each (`final` on the last of a turn).
    console.log(`nestor: ${text}`);
  }

  connected(up: boolean): void {
    // TODO(hardware): a dim light when the link to the core is down, for instance.
    console.log(`light: ${up ? "connected" : "disconnected"}`);
  }
}
