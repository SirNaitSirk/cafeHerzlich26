import { subscribe, type AppEvent } from "@/lib/events";

/**
 * Server-Sent Events endpoint. Every screen (Kasse, Küche, Abholmonitor, Terminal)
 * subscribes here and receives real-time signals when orders or the catalog change.
 *
 * Must run on the Node.js runtime (in-process event bus) and never be cached.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => controller.enqueue(encoder.encode(data));

      // Initial comment so the client's connection opens immediately.
      send(`: connected\n\n`);

      const onEvent = (event: AppEvent) => {
        send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      };
      const unsubscribe = subscribe(onEvent);

      // Heartbeat keeps proxies/browsers from dropping an idle connection.
      const heartbeat = setInterval(() => send(`: ping\n\n`), 25_000);

      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
