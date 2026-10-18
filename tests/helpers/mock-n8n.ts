import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";

export interface MockCall {
  path: string;
  headers: IncomingHttpHeaders;
  body: unknown;
}

export interface MockReply {
  status: number;
  body?: unknown;
  delayMs?: number;
  /** Cierra la conexión sin responder (n8n caído o reiniciándose). */
  drop?: boolean;
}

/** Servidor HTTP local que imita los webhooks de n8n (nunca se llama al n8n real). */
export async function startMockN8n(port = 0) {
  const calls: MockCall[] = [];
  let reply: (call: MockCall) => MockReply = () => ({ status: 200, body: { ok: true } });

  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      let body: unknown = raw;
      try {
        body = JSON.parse(raw);
      } catch {
        /* cuerpo no JSON */
      }
      const call = { path: req.url ?? "", headers: req.headers, body };
      calls.push(call);
      const r = reply(call);
      if (r.drop) return void req.socket.destroy();
      setTimeout(() => {
        if (res.destroyed) return;
        res.writeHead(r.status, { "content-type": "application/json" }).end(JSON.stringify(r.body ?? {}));
      }, r.delayMs ?? 0);
    });
  });
  await new Promise<void>((ok) => server.listen(port, "127.0.0.1", ok));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/webhook`;

  return {
    url,
    calls,
    setReply(fn: (call: MockCall) => MockReply) {
      reply = fn;
    },
    reset() {
      calls.length = 0;
      reply = () => ({ status: 200, body: { ok: true } });
    },
    close() {
      server.closeAllConnections();
      return new Promise<void>((ok) => server.close(() => ok()));
    },
  };
}
