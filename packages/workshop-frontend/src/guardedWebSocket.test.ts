// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { createGuardedWebSocket } from "./guardedWebSocket";

function installSocket(
  readyState: number,
  send: ReturnType<typeof vi.fn<(data: unknown) => void>>,
) {
  class MockWebSocket {
    static OPEN = 1;
    readyState = readyState;
    send = send;
  }
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
}

describe("createGuardedWebSocket", () => {
  const OriginalWebSocket = globalThis.WebSocket;

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
    vi.restoreAllMocks();
  });

  it("does not call the native sender after the socket starts closing", () => {
    const send = vi.fn<(data: unknown) => void>();
    installSocket(2, send);

    const guarded = createGuardedWebSocket("wss://example.test/api");

    expect(() => guarded.send("late release")).toThrow("WebSocket is not open.");
    expect(send).not.toHaveBeenCalled();
  });

  it("forwards messages while the socket is open", () => {
    const send = vi.fn<(data: unknown) => void>();
    installSocket(1, send);

    createGuardedWebSocket("wss://example.test/api").send("hello");

    expect(send).toHaveBeenCalledWith("hello");
  });
});
