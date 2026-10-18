// n8n simulado para las pruebas E2E: registra los webhooks recibidos y responde 200.
// GET /__calls devuelve lo recibido; POST /__reset lo vacía. Nunca se llama al n8n real.
import { createServer } from "node:http";

const port = Number(process.env.MOCK_N8N_PORT || 5799);
let calls = [];

createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const send = (status, body) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
    if (req.method === "GET" && req.url === "/__calls") return send(200, calls);
    if (req.method === "POST" && req.url === "/__reset") {
      calls = [];
      return send(200, { ok: true });
    }
    if (req.method === "GET" && req.url === "/__health") return send(200, { ok: true });
    let body = raw;
    try {
      body = JSON.parse(raw);
    } catch {
      /* cuerpo no JSON */
    }
    calls.push({ path: req.url, headers: req.headers, body });
    send(200, { ok: true });
  });
}).listen(port, "127.0.0.1", () => console.log(`[mock-n8n] escuchando en ${port}`));
