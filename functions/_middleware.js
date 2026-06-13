export async function onRequest(context) {
  const response = await context.next();
  const path = new URL(context.request.url).pathname;

  if (path.startsWith("/zvuk/")) {
    if (path.endsWith(".wasm")) {
      const r = new Response(response.body, response);
      r.headers.set("Content-Type", "application/wasm");
      return r;
    }
    if (path.endsWith(".js")) {
      const r = new Response(response.body, response);
      r.headers.set("Content-Type", "text/javascript; charset=utf-8");
      return r;
    }
  }

  return response;
}
