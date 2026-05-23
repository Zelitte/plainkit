// Vráti verejný Turnstile site key pre frontend
// Konvertované z Netlify Functions na Cloudflare Pages Functions

export async function onRequestGet(context) {
  const { env } = context;
  return new Response(
    JSON.stringify({
      siteKey: env.TURNSTILE_SITEKEY || '',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    }
  );
}
