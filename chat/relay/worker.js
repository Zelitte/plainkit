import { DurableObject } from "cloudflare:workers";

// One ChatRoom Durable Object instance == one room.
// It stores NOTHING. It only forwards whatever one socket sends to the others.
// The payloads it forwards are encrypted in the browser, so it cannot read them.
//
// In addition, on every join/leave it broadcasts a tiny unencrypted system
// message of the form {"_t":"count","n":<number>} so each client can show
// how many people are in the room. The number is metadata, not content.
export class ChatRoom extends DurableObject {
  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    // Hibernation API: the room sleeps (and costs nothing) when idle,
    // and wakes up automatically when a message arrives.
    this.ctx.acceptWebSocket(server);
    this.broadcastCount();
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, message) {
    // Pure relay: forward to everyone else in this room.
    for (const other of this.ctx.getWebSockets()) {
      if (other !== ws) {
        try { other.send(message); } catch (_) { /* socket gone */ }
      }
    }
  }

  webSocketClose(ws, code, reason, wasClean) {
    try { ws.close(code, "bye"); } catch (_) {}
    this.broadcastCount(ws);
  }

  webSocketError(ws, err) {
    try { ws.close(1011, "error"); } catch (_) {}
    this.broadcastCount(ws);
  }

  broadcastCount(except) {
    const sockets = this.ctx.getWebSockets();
    const others = except ? sockets.filter(w => w !== except) : sockets;
    const msg = JSON.stringify({ _t: "count", n: others.length });
    for (const ws of others) {
      try { ws.send(msg); } catch (_) {}
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    if (parts.length === 0) {
      return new Response("plainkit relay ok", { status: 200 });
    }

    if (parts[0] === "room" && parts[1]) {
      const roomId = parts[1].slice(0, 64);
      const id = env.CHAT_ROOM.idFromName(roomId);
      const stub = env.CHAT_ROOM.get(id);
      return stub.fetch(request);
    }

    return new Response("not found", { status: 404 });
  },
};
