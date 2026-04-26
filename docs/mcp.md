# Cruzar Insights MCP

Remote MCP server exposing US-MX border wait-time data + smart routing to AI clients.

**Endpoint:** `https://www.cruzar.app/mcp` (apex `cruzar.app` 307-redirects to www; clients that don't follow redirects on POST should use `www.` directly)
**Transport:** Streamable HTTP (stateless)
**Auth:** `Authorization: Bearer <CRUZAR_MCP_KEY>`

## Tools

- `cruzar_smart_route(lat, lng, direction?, limit?)` — Ranks RGV crossings by total time = current wait + drive distance from origin. Returns top 5.
- `cruzar_live_wait(port_id?)` — Most recent CBP reading for one port, or all RGV ports if omitted. Includes vehicle / SENTRI / pedestrian / commercial lanes.
- `cruzar_best_times(port_ids[], day?, hour?)` — Historical average wait by day-of-week × hour over the last 90 days. Filter by specific DOW (0=Sun..6=Sat) or hour (0-23).
- `cruzar_briefing(port_id)` — One-shot markdown summary: current wait + historical baseline + anomaly flag (>+50% / <-50%) + best remaining window today. The broker decision artifact.

## Port IDs (RGV)

| port_id | Crossing |
|---|---|
| 230501 | Hidalgo |
| 230502 | Pharr–Reynosa |
| 230503 | Anzaldúas |
| 230402 | Laredo World Trade Bridge |
| 230401 | Laredo I (Gateway) |
| 230301 | Eagle Pass |
| 535502 | Brownsville Veterans |
| 535504 | Brownsville Gateway |

Full list available via `cruzar_live_wait()` (no args).

## Connect from Claude Desktop / Code

```json
{
  "mcpServers": {
    "cruzar-insights": {
      "transport": {
        "type": "http",
        "url": "https://www.cruzar.app/mcp",
        "headers": {
          "Authorization": "Bearer <YOUR_KEY>"
        }
      }
    }
  }
}
```

## Try it from curl

```bash
curl -X POST https://www.cruzar.app/mcp \
  -H "Authorization: Bearer $CRUZAR_MCP_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Backend status

v0.1 wraps the heuristic prediction stack already running on cruzar.app. The v0.4 ML model (RF + XGBoost trained 2026-04-25, +16-18% vs CBP climatology baseline at 6h on Laredo WTB and Brownsville Veterans) is deployed separately and will swap in via Path B without changing this MCP surface.

## Get an API key

DM Diego — keys are issued manually in v0.1.
