# Mayordomía Gateway (Node)

Reemplazo del backend Apps Script del proyecto Mayordomía. Mantiene Google
Sheets como capa de persistencia y corre como servicio Node 20 + Express
sobre Docker. Diseñado para correr en la Raspberry Pi de Diego junto a
MisNumeros y StatusCluster, con el mismo patrón de docker-compose + nginx
externo + Cloudflare Tunnel.

## Por qué existe

Apps Script escala bien hasta ~5.000 req/día, pero tiene cold start variable
(1–5 s), una cuota global de tiempo de ejecución de 90 min/día en cuentas
personales, y no soporta concurrencia horizontal. Este gateway elimina esos
tres problemas manteniendo el esquema de Sheets y el envelope de respuesta
idénticos — el frontend no necesita cambios para migrar.

## Estado actual

Implementado en este PR (Fase 0 + parte de Fase 1):

- Core infra: `envelope`, `errors`, `validation`, `config`, `logging`.
- Sheets: `client` (googleapis) + read paths (`rows`, `findOne`, `append`, `updateWhere`).
- Auth: `tokeninfo` + RBAC (`context`, `requirePermission`, `verifyIdentity`).
- Router: `register`, `dispatch` con options `{ auth, identity, permission, audit }`.
- Audit: escritura best-effort a `AuditLog`.
- Rutas portadas: `system.health`, `catalog.organization`, `catalog.listOrganizations`, `catalog.listSites`, `catalog.listUsers`, `catalog.listRoles`.
- Server: Express + pino-http + CORS configurable + `GET /ping` + `POST /api`.
- 24 tests unitarios verdes (`npm test`).

Pendiente (Fases 2–4): Bootstrap (DriveApp descriptor), Requests (create/approve/reject), Resources, Events, Operations, Maintenance, Purchases, Notifications, Resend queue, Calendar, Migrations.

## Quickstart (dev local)

```bash
cd gateway
npm install
cp .env.example .env       # editar SPREADSHEET_ID y GOOGLE_SERVICE_ACCOUNT_FILE
npm test                   # 24/24 verde
npm run dev                # tsx watch en :3000
curl http://localhost:3000/ping
```

## Despliegue en la Raspberry Pi

### 1. Service Account (una sola vez)

```bash
# En tu Mac, con gcloud autenticado en el proyecto GCP de Mayordomía:
gcloud iam service-accounts create mayordomia-gateway \
  --project=<tu-proyecto-gcp>

gcloud iam service-accounts keys create ./sa-key.json \
  --iam-account=mayordomia-gateway@<tu-proyecto>.iam.gserviceaccount.com
```

### 2. Compartir la spreadsheet

Abrí la spreadsheet en Google Sheets → **Share** → agregá el email del Service
Account (`mayordomia-gateway@<proyecto>.iam.gserviceaccount.com`) con permiso
**Editor**.

### 3. Estructura en la Pi

```bash
ssh pi@<pi-ip> "mkdir -p /mayordomia/{secrets,dist,web}"
ssh pi@<pi-ip> "chmod 700 /mayordomia/secrets"

# Copiá el SA key (desde tu Mac):
scp ./sa-key.json pi@<pi-ip>:/mayordomia/secrets/sa-key.json
ssh pi@<pi-ip> "chmod 600 /mayordomia/secrets/sa-key.json"

# Cloná o copiá el código del gateway:
ssh pi@<pi-ip> "git clone <repo-url> /mayordomia/repo"
# O copiá manualmente este directorio `gateway/` y `deploy/` a /mayordomia/.
```

### 4. Variables de entorno

```bash
ssh pi@<pi-ip>
cat > /mayordomia/.env <<'EOF'
SPREADSHEET_ID=<tu-spreadsheet-id>
ALLOWED_ORIGINS=https://mayordomia.tudominio.com
EOF
chmod 600 /mayordomia/.env
```

### 5. Build del frontend

```bash
# En tu Mac, dentro del repo principal de Mayordomía:
npm ci
npm run build

# Copiá dist/ a la Pi:
rsync -avz dist/ pi@<pi-ip>:/mayordomia/dist/
```

### 6. Levantar los servicios

Copiá `deploy/docker-compose.yml`, `deploy/web/nginx.conf` y `deploy/.env.example`
a `/mayordomia/` (los paths que ya vienen son relativos a esa ubicación).

```bash
ssh pi@<pi-ip>
cd /mayordomia
docker compose up -d --build
docker compose ps
docker compose logs -f api
curl http://localhost:8080/ping   # si tu nginx externo mapea :8080 -> :80 de mayordomia-web
```

### 7. Reverse proxy público

Apuntá tu Cloudflare Tunnel (o el nginx externo que ya tengas) a
`http://mayordomia-web:80` dentro de la red Docker. El `nginx.conf` interno
ya rutea `/api/*` al gateway Node.

Si usás un Cloudflare Tunnel existente, agregá una entrada:

```yaml
# en tu cloudflared config (no este repo)
- hostname: mayordomia.tudominio.com
  service: http://mayordomia-web:80
```

### 8. Google OAuth — Authorized Origins

En Google Cloud Console → Credentials → tu OAuth Client → **Authorized
JavaScript origins**, agregá:

- `https://mayordomia.tudominio.com` (producción)

Sin esto Google rechaza el `gsi.client` con `origin_mismatch`.

## Actualizar el gateway después de un cambio

```bash
# En tu Mac:
cd .worktrees/feature-gateway-node-port
# ... editar archivos ...
npm test                 # verde antes de pushear
git commit -am "..."
git push origin feature/gateway-node-port

# En la Pi:
cd /mayordomia/repo
git pull
cd /mayordomia
docker compose build api
docker compose up -d api
```

## Estructura del código

```
gateway/
├── src/
│   ├── index.ts                # bootstrap + graceful shutdown
│   ├── server.ts               # Express setup + rutas
│   ├── config.ts               # env loader
│   ├── envelope.ts             # {ok,data,error,meta}
│   ├── errors.ts               # ApiException + ApiError factory
│   ├── validation.ts           # string, id, email, enumValue, safeText
│   ├── logging.ts              # pino
│   ├── sheets/
│   │   └── client.ts           # googleapis wrapper
│   ├── auth/
│   │   └── service.ts          # verifyIdentity, context, requirePermission
│   ├── audit/
│   │   └── service.ts          # best-effort AuditLog writes
│   ├── router/
│   │   └── index.ts            # register, dispatch
│   └── routes/
│       ├── health.ts
│       └── catalog.ts
├── tests/                       # vitest
├── deploy/                      # templates para la Pi (docker-compose, nginx, .env)
├── Dockerfile
├── .env.example
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Diferencias clave vs Apps Script

| Apps Script | Node gateway |
|---|---|
| `SpreadsheetApp.openById()` | `google.sheets({version:'v4'}).spreadsheets.values.*` |
| `Script Properties` | env vars + docker secret |
| `UrlFetchApp.fetch()` | `fetch()` nativo |
| `Logger.log()` | pino estructurado |
| `Utilities.getUuid()` | `crypto.randomUUID()` / `uuid` |
| Runtime: serial, cold start | Concurrente, persistent |
| Cuota: 90 min/día wall-clock | Sin cuota de runtime (rate-limit propio) |
| Deploy: `clasp push` + `clasp deploy` | `docker compose up -d --build` |

## Gotchas conocidos

- **DNS collision en Docker multi-proyecto**: este compose usa network aliases
  explícitos (`mayordomia-web`, `mayordomia-api`) para evitar el bug que
  MisNumeros ya padeció. Si agregás un tercer servicio que necesita hablar
  con el gateway, usá `mayordomia-api:3000` como hostname, no `api`.
- **Sheets API no es una DB**: no hay transacciones multi-sheet. Los write
  paths usan `expectedVersion` para concurrencia optimista (igual que el
  código Apps Script original).
- **SA key = secreto real**: perder el archivo implica regenerar. Backup
  cifrado (age o gpg) recomendado.
- **Cold start eliminado pero latencia Sheets API**: ~200–500 ms por request
  batch. Para tu volumen es despreciable.
