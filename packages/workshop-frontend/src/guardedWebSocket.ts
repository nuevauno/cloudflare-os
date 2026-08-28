/**
 * Create a browser WebSocket whose `send()` fails synchronously once the socket is no longer open.
 *
 * Cap'n Web can release a pipelined capability in the same turn in which the browser reports a
 * close. Native WebSocket logs that late send before the RPC session can convert it into its normal
 * broken-session path. Guarding the call keeps the console clean and lets Cap'n Web handle the
 * thrown connection error through `onRpcBroken()`.
 */
export function createGuardedWebSocket(url: string): WebSocket {
  const socket = new WebSocket(url);
  const nativeSend = socket.send.bind(socket) as (
    data: string | ArrayBufferLike | Blob | ArrayBufferView,
  ) => void;
  socket.send = (data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
    if (socket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open.");
    }
    nativeSend(data);
  };
  return socket;
}
