# Runbook: Cloudflare Tunnel para Mayordomía

Asumimos:
- **Hostname**: `mayordomia.fewlines.com.ar`
- **Tunnel**: reutilizamos uno existente en la Pi (no creamos nuevo)
- **Auth**: vos corrés `cloudflared tunnel login` desde la Pi

Todo lo de abajo va como `diego@piserver` (o como sea que ssh-ees a tu Pi).

---

## Paso 1 — Identificar el tunnel existente

Desde la Pi:

```bash
# Si cloudflared no está, instalalo:
# curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
#   | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
# echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared bookworm main' \
#   | sudo tee /etc/apt/sources.list.d/cloudflared.list
# sudo apt update && sudo apt install -y cloudflared

# Listar tunnels existentes en tu cuenta:
cloudflared tunnel list
```

La salida es tipo:

```
ID                                      NAME        CREATED
3bb594f4-0d04-4b4b-a9ac-3fd019825974    mi-tunel    2026-04-27
29d97281-6198-47be-85c5-57f8ae0f54f8    piserver    2026-09-08
```

**Anotá el `NAME` y `ID`** del tunnel que está corriendo en la Pi (probablemente `piserver` o `mi-tunel` — el que veas en tu lista). Vamos a llamarlos:

```bash
export TUNNEL_NAME="<el que aparece>"
export TUNNEL_ID="<el UUID correspondiente>"
export HOSTNAME="mayordomia.fewlines.com.ar"
```

---

## Paso 2 — Login (una sola vez, si ya está hecho podés saltear)

```bash
cloudflared tunnel login
```

Esto te abre un browser en tu Mac para autorizar el tunnel en tu cuenta de Cloudflare. Una vez autorizado, baja un `cert.pem` a `~/.cloudflared/cert.pem`.

---

## Paso 3 — Levantar credenciales del tunnel en la Pi

```bash
# Si ya hay un cert.pem y un <TUNNEL_ID>.json en ~/.cloudflared/ del Pi:
ls -la ~/.cloudflared/
# Deberías ver: cert.pem, <TUNNEL_ID>.json, config.yml
```

Si ya está todo bien, seguimos. Si falta el JSON de credentials:

```bash
cloudflared tunnel token $TUNNEL_NAME
# O, si el tunnel existe pero las credenciales no:
cloudflared tunnel route dns $TUNNEL_NAME placeholder.test
# (Esto regenera las credenciales si están corruptas)
```

---

## Paso 4 — Crear estructura en /mayordomia/

Desde la Pi:

```bash
sudo mkdir -p /mayordomia/{secrets,cloudflared,web,dist}
sudo chown -R $USER:$USER /mayordomia
chmod 700 /mayordomia/secrets /mayordomia/cloudflared
```

---

## Paso 5 — Copiar el SA key + el resto de archivos

Desde tu Mac (esta terminal):

```bash
# Ajustá las rutas a donde estén los archivos
PI=diego@piserver

# SA key (Google Service Account)
scp ./sa-key.json $PI:/mayordomia/secrets/sa-key.json

# docker-compose + nginx + cloudflared config
scp gateway/deploy/docker-compose.yml $PI:/mayordomia/
scp gateway/deploy/web/nginx.conf $PI:/mayordomia/web/
scp gateway/deploy/cloudflared/config.yml.template $PI:/mayordomia/cloudflared/config.yml.template

# Dist del frontend (si ya lo construiste)
rsync -avz --delete dist/ $PI:/mayordomia/dist/

# .env con SPREADSHEET_ID y ALLOWED_ORIGINS
scp gateway/deploy/.env.example $PI:/mayordomia/.env
# Después edita $PI:/mayordomia/.env en la Pi con tus valores reales.

# Permisos
ssh $PI "chmod 600 /mayordomia/secrets/sa-key.json /mayordomia/.env"
```

---

## Paso 6 — Editar el config.yml del tunnel en la Pi

```bash
ssh $PI
cd /mayordomia/cloudflared

# Copiá el template y editá los placeholders:
cp config.yml.template config.yml
$EDITOR config.yml
```

Reemplazá:
- `${TUNNEL_NAME}` → el nombre que anotaste en el paso 1
- `${TUNNEL_ID}` → el UUID correspondiente
- `${HOSTNAME}` → `mayordomia.fewlines.com.ar`
- **Agregá la línea de ingress para `mayordomia.fewlines.com.ar` ANTES de las reglas existentes** y respetá el catch-all `http_status:404` al final.

También copiá el JSON de credenciales al directorio:

```bash
cp ~/.cloudflared/$TUNNEL_ID.json /mayordomia/cloudflared/
chmod 600 /mayordomia/cloudflared/$TUNNEL_ID.json
```

---

## Paso 7 — Crear el registro DNS (CNAME al tunnel)

Desde la Pi:

```bash
cloudflared tunnel route dns $TUNNEL_NAME mayordomia.fewlines.com.ar
```

Esto crea automáticamente el CNAME en Cloudflare:
- `mayordomia.fewlines.com.ar` → `<TUNNEL_ID>.cfargotunnel.com`

Verificá:

```bash
dig mayordomia.fewlines.com.ar +short
# Debería devolver: <TUNNEL_ID>.cfargotunnel.com.
```

Si preferís crearlo a mano desde la UI de Cloudflare:
- Type: `CNAME`
- Name: `mayordomia`
- Target: `<TUNNEL_ID>.cfargotunnel.com`
- Proxy: **Proxied** (naranja, no DNS-only)

---

## Paso 8 — Levantar todo

```bash
ssh $PI
cd /mayordomia

# Editá el .env con tus valores reales:
$EDITOR .env
# Requeridos: SPREADSHEET_ID, ALLOWED_ORIGINS=https://mayordomia.fewlines.com.ar

docker compose up -d --build
docker compose ps

# Esperá ~30s y verificá:
docker compose logs api | tail -20
docker compose logs tunnel | tail -10
```

Salida esperada:
- `api`: `mayordomia-gateway listening` en puerto 3000
- `tunnel`: `Connection established` con el conn index

---

## Paso 9 — Verificación end-to-end

Desde tu Mac:

```bash
# Liveness pública (a través del tunnel):
curl -i https://mayordomia.fewlines.com.ar/ping
# Esperado: HTTP 200, body con envelope ok=true

# API:
curl -i https://mayordomia.fewlines.com.ar/api/health
# Esperado: HTTP 200, body con envelope ok=true (proxea /ping del api)

# Health real con auth (POST /api con action=system.health):
curl -i -X POST https://mayordomia.fewlines.com.ar/api \
  -H "Content-Type: application/json" \
  -d '{"action":"system.health","organizationId":"org_xxxxxx","auth":{"accessToken":"<google-token>"}}'
# Esperado: HTTP 200 con data.version='0.1.0' y data.sheets.status='OK'

# DNS:
dig mayordomia.fewlines.com.ar +short
# Esperado: <TUNNEL_ID>.cfargotunnel.com.
```

---

## Paso 10 — Google Cloud Console (Authorized Origin)

Esto es **crítico** y se hace desde tu navegador:

1. Andá a https://console.cloud.google.com/apis/credentials
2. Buscá tu OAuth Client ID (el que cargaste como `VITE_GOOGLE_CLIENT_ID`)
3. **Authorized JavaScript origins** → agregar:
   - `https://mayordomia.fewlines.com.ar`
4. Guardar.

Sin esto Google rechaza el login con `origin_mismatch` aunque el tunnel esté perfecto.

---

## Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| `cloudflared tunnel route dns` falla con 1033 | Zone no delegada a Cloudflare | Verificá `whois fewlines.com.ar` y la UI de Cloudflare |
| `dig` devuelve NXDOMAIN | DNS no creado todavía | Repetir paso 7 |
| Tunnel conecta pero curl da 502 | El servicio `web` no levantó / `mayordomia-web` no resuelve dentro de la network | Verificá `docker compose ps` y logs de `tunnel` |
| API responde `NOT_CONFIGURED` | Falta `GOOGLE_SERVICE_ACCOUNT_FILE` o el archivo no se montó | `docker compose exec api ls -la /run/secrets/` |
| Google login tira `origin_mismatch` | Falta el origin autorizado | Paso 10 |
| `client_max_body_size` corta uploads | (futuro) si agregás upload de fotos | `web/nginx.conf` ya tiene `client_max_body_size 10m` |

---

## Rollback

Si algo se rompe y querés volver al setup anterior:

```bash
ssh $PI
cd /mayordomia
docker compose down   # NO -v, eso borra dist/

# Borrar solo el CNAME:
cloudflared tunnel route dns --remove $TUNNEL_NAME mayordomia.fewlines.com.ar

# O a mano desde la UI de CF: borrar el registro CNAME.
```

El Apps Script en `https://script.google.com/.../exec` sigue intacto — Mayordomía no pierde el fallback.
