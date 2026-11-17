import { describe, it, expect } from "vitest";
import { decideDelivery, electedSession } from "../src/delivery.js";

describe("decideDelivery — origin-first delivery ladder", () => {
  it("delivers a full turn in the session that created the job when it is alive", () => {
    expect(
      decideDelivery({
        selfSessionId: "A",
        originSessionId: "A",
        aliveSessionIds: ["A", "B", "C"],
      }),
    ).toBe("turn");
  });

  it("defers in a non-origin session while the origin session is alive", () => {
    expect(
      decideDelivery({
        selfSessionId: "B",
        originSessionId: "A",
        aliveSessionIds: ["A", "B", "C"],
      }),
    ).toBe("defer");
  });

  it("delivers a full turn in a lone session even when it is not the origin (single-session projects stay simple)", () => {
    expect(
      decideDelivery({
        selfSessionId: "B",
        originSessionId: "A", // A has since closed
        aliveSessionIds: ["B"],
      }),
    ).toBe("turn");
  });

  it("waits in every session when origin is gone and several sessions are open", () => {
    for (const self of ["B", "C", "D"]) {
      expect(
        decideDelivery({
          selfSessionId: self,
          originSessionId: "A", // A has since closed
          aliveSessionIds: ["B", "C", "D"],
        }),
      ).toBe("wait");
    }
  });

  it("treats a job with no recorded origin (legacy row) as origin-absent", () => {
    // multi-session → wait, never a surprise turn
    expect(
      decideDelivery({
        selfSessionId: "B",
        originSessionId: undefined,
        aliveSessionIds: ["B", "C"],
      }),
    ).toBe("wait");
    // lone session → full turn
    expect(
      decideDelivery({
        selfSessionId: "B",
        originSessionId: undefined,
        aliveSessionIds: ["B"],
      }),
    ).toBe("turn");
  });

  it("always counts self as alive even if the presence set omits it", () => {
    // origin gone, presence hasn't recorded self yet: self is the only known
    // live session → lone-session turn, never a phantom multi-session wait.
    expect(
      decideDelivery({
        selfSessionId: "Z",
        originSessionId: "A",
        aliveSessionIds: [],
      }),
    ).toBe("turn");
  });

  it("elects the same session (smallest live id, self included) from every session", () => {
    const alive = ["D", "B", "C"]; // unsorted on purpose
    for (const self of alive) {
      expect(electedSession({ selfSessionId: self, aliveSessionIds: alive })).toBe("B");
    }
    // self counts as alive even if presence has not recorded it yet
    expect(electedSession({ selfSessionId: "A", aliveSessionIds: alive })).toBe("A");
  });
});
