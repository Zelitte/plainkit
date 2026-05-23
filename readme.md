# Prekladač — deploy návod pre Cloudflare Pages

## Čo to je
Webová stránka na preklad dokumentov (.docx, .xlsx, .pptx, .txt, .md) cez Google Gemini API.
Limity: 10 dokumentov / 400 strán denne na užívateľa, ochrana cez Cloudflare Turnstile.

## Štruktúra
```
.
├── index.html                      ← frontend
├── _headers                        ← bezpečnostné hlavičky
├── googlec83469e22a29902d.html     ← Google Search Console overenie
├── og-image.png
└── functions/
    └── api/
        ├── translate.js            ← preklad + limity (Cloudflare KV)
        └── config.js               ← dodáva Turnstile site key
```

## Pred deployom — čo musíš urobiť v Cloudflare dashboarde

### 1. Vytvor KV namespace
Cloudflare Dashboard → Workers & Pages → KV → Create namespace
- Názov: `LIMITS_KV`

### 2. Vytvor Pages projekt
Workers & Pages → Create → Pages → Connect to Git alebo Upload files

### 3. Nastav environment variables
V Pages projekte → Settings → Environment variables → Add:
- `GEMINI_API_KEY` = (tvoj existujúci Gemini kľúč z Netlify)
- `TURNSTILE_SECRET` = (tvoj existujúci Turnstile secret z Netlify)
- `TURNSTILE_SITEKEY` = (tvoj existujúci Turnstile site key z Netlify)

### 4. Napoj KV namespace na Pages projekt
Pages projekt → Settings → Functions → KV namespace bindings → Add:
- Variable name: `LIMITS_KV`
- KV namespace: vyber `LIMITS_KV` ktorú si vytvoril

### 5. Pridaj doménu siet.app
Pages projekt → Custom domains → Set up a custom domain → `siet.app`
(DNS záznamy sa nastavia automaticky ak doménu spravuje Cloudflare)

### 6. Aktualizuj Turnstile widget
Cloudflare Dashboard → Turnstile → tvoj widget → Hostnames:
- Pridaj `siet.app`
- Môžeš nechať aj staré `preklad.netlify.app` počas prechodu

## Deploy — drag & drop
1. Vytvor ZIP zo všetkých súborov (zachovaj štruktúru priečinkov)
2. Pages projekt → Deploys → Upload
3. Pretiahni ZIP

## Presmerovanie zo starého Netlify
Na starom Netlify projekte (`preklad.netlify.app`) pridaj súbor `_redirects`:
```
/* https://siet.app/preklad/:splat 301!
```

## Čo sa zmenilo oproti Netlify verzii
| Netlify | Cloudflare |
|---|---|
| `@netlify/blobs` | Cloudflare KV (`LIMITS_KV`) |
| `x-nf-client-connection-ip` | `CF-Connecting-IP` |
| `process.env.GEMINI_API_KEY` | `env.GEMINI_API_KEY` (cez context) |
| `export default async (req)` | `export async function onRequestPost(context)` |
| `netlify/functions/translate.js` | `functions/api/translate.js` |
| `netlify.toml` headers | `_headers` súbor |

## Manuálny reset limitov (ak treba)
Cloudflare Dashboard → Workers & Pages → KV → LIMITS_KV → View → vymaž záznamy s prefixom `g_` (globál) alebo `u_` (user)
