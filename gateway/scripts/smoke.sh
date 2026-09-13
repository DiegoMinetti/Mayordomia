#!/bin/sh
# Quick smoke test for Mayordomía gateway running in container.
set -e

echo "=== /ping ==="
docker exec mayordomia-api-1 node -e 'require("http").get("http://localhost:3000/ping", r => { let d=""; r.on("data", c=>d+=c); r.on("end", () => console.log("status="+r.statusCode, d)) }).on("error", e => console.log("err="+e.message))'

echo
echo "=== sqlite tables + migrations ==="
docker exec mayordomia-api-1 node -e '
const s = require("node:sqlite");
const db = new s.DatabaseSync("/mayordomia/data/mayordomia.db");
const r = db.prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type = '"'"'table'"'"' AND name NOT LIKE '"'"'sqlite_%'"'"' AND name != '"'"'_mayordomia_migrations'"'"'`).get();
console.log("business tables:", r.n);
console.log("migrations:", JSON.stringify(db.prepare("SELECT version, name FROM _mayordomia_migrations ORDER BY version").all()));
'

echo
echo "=== /auth/me without token (expect UNAUTHORIZED) ==="
docker exec mayordomia-api-1 node -e '
const http = require("http");
const req = http.request({hostname:"localhost",port:3000,path:"/auth/me",method:"POST",headers:{"content-length":0}}, r => {
  let d=""; r.on("data",c=>d+=c); r.on("end",()=>console.log("status="+r.statusCode, d));
});
req.on("error", e => console.log("err="+e.message));
req.end();
'

echo
echo "=== /auth/register (FK fail expected: no org yet) ==="
docker exec mayordomia-api-1 node -e '
const http = require("http");
const body = JSON.stringify({email:"smoke@test.com",password:"hunter2-but-real",organizationId:"org_smoke123"});
const req = http.request({hostname:"localhost",port:3000,path:"/auth/register",method:"POST",headers:{"content-type":"application/json","content-length":Buffer.byteLength(body)}}, r => {
  let d=""; r.on("data",c=>d+=c); r.on("end",()=>console.log("status="+r.statusCode, d));
});
req.write(body);
req.end();
'
