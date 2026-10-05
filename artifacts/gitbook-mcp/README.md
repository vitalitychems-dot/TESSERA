# Gitbook MCP connector

Mesh agents read and write the private docs repo `vitalitychems-dot/Gitbook` through this package. It speaks MCP on stdio and the same tools over a local HTTP/JSON API. Both paths use the GitHub REST API.

The token comes from `GITBOOK_GITHUB_TOKEN`. Do not put a token in source, in this README, or in git.

File changes (`write_handoff`, `propose_page_change`) always open a **draft pull request** on a `gitbook-mcp/…` branch. They do not push to `main` and they do not merge. `recent_changes` is the overlap check: latest `main` commits plus open pull requests. Run it before claiming work.

`route_task` only suggests a lane. It does not assign or claim a task. Tessera assigns work.

## Tools

| Tool | What it does |
| --- | --- |
| `search_docs` | Search Gitbook markdown. Uses GitHub code search, then a bounded tree scan if code search returns 403, 422, or 503. |
| `read_page` | Read one file from the default branch. |
| `list_pages` | List markdown files and directories. |
| `get_board` | Comments on Gitbook issue #2, the coordination board. |
| `post_board_update` | Comment on issue #2. The body always starts with `AGENT: <name>`. |
| `read_handoff` | Read `mesh/HANDOFF.md`. |
| `write_handoff` | Append a handoff note through a draft pull request. Existing text stays in the branch copy. |
| `propose_page_change` | Put proposed page content on a branch and open a draft pull request. `main` is not edited. |
| `recent_changes` | Latest `main` commits and open pull requests. |
| `route_task` | Score `agents.json` by keyword and specialty. Ties break by registry order. No match falls back to Tessera with `fallback: true`. |

Security and Build are marked `fileWrites: false` in `agents.json`. If `GITBOOK_AGENT_LANE` is `security` or `build`, or the call passes that `lane`, draft pull requests are refused. Board comments stay available so a sweep can still be reported.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `GITBOOK_GITHUB_TOKEN` | empty | GitHub token with access to the private Gitbook repo. Required for GitHub tools. |
| `GITBOOK_GITHUB_API` | `https://api.github.com` | REST API base. |
| `GITBOOK_GITHUB_OWNER` | `vitalitychems-dot` | Repository owner. |
| `GITBOOK_GITHUB_REPO` | `Gitbook` | Repository name. |
| `GITBOOK_DEFAULT_BRANCH` | `main` | Branch used for reads and as the pull request base. |
| `GITBOOK_BOARD_ISSUE` | `2` | Coordination board issue. |
| `GITBOOK_HANDOFF_PATH` | `mesh/HANDOFF.md` | Handoff page. |
| `GITBOOK_AGENT_LANE` | empty | Lane id from `agents.json`. Set this to `security` or `build` to refuse file writes. |
| `GITBOOK_HTTP_HOST` | `127.0.0.1` | HTTP bind address. Keep this on loopback. |
| `GITBOOK_HTTP_PORT` | `8787` | HTTP port. |

`route_task` works without a token. Every other tool returns a clear error until `GITBOOK_GITHUB_TOKEN` is set.

## MCP stdio

Build once, then point the agent at the compiled entry:

```bash
pnpm --filter @workspace/gitbook-mcp run build
```

```json
{
  "mcpServers": {
    "gitbook": {
      "command": "node",
      "args": ["artifacts/gitbook-mcp/dist/mcp.js"],
      "env": {
        "GITBOOK_GITHUB_TOKEN": "${GITBOOK_GITHUB_TOKEN}"
      }
    }
  }
}
```

Use the path from the TESSERA repo root, or an absolute path to `dist/mcp.js`. The process speaks MCP over stdin/stdout with `Content-Length` framing. Set `GITBOOK_AGENT_LANE` in that `env` block when the process belongs to one lane.

A security sweep config adds the lane and still uses the same command:

```json
{
  "mcpServers": {
    "gitbook": {
      "command": "node",
      "args": ["artifacts/gitbook-mcp/dist/mcp.js"],
      "env": {
        "GITBOOK_GITHUB_TOKEN": "${GITBOOK_GITHUB_TOKEN}",
        "GITBOOK_AGENT_LANE": "security"
      }
    }
  }
}
```

## HTTP

```bash
GITBOOK_GITHUB_TOKEN="***" pnpm --filter @workspace/gitbook-mcp run start:http
```

`start:http` runs `node dist/http.js` and listens on `127.0.0.1:8787` unless the host and port variables say otherwise.

| Method | Path | Body or query |
| --- | --- | --- |
| GET | `/health` | none |
| GET | `/v1/tools` | none |
| POST | `/v1/search_docs` | `{ "query": "handoff" }` |
| POST | `/v1/read_page` | `{ "path": "mesh/HANDOFF.md" }` |
| GET or POST | `/v1/list_pages` | `?dir=mesh` or `{ "dir": "mesh" }` |
| GET or POST | `/v1/get_board` | none |
| POST | `/v1/post_board_update` | `{ "agent": "Tessera", "text": "..." }` |
| GET or POST | `/v1/read_handoff` | none |
| POST | `/v1/write_handoff` | `{ "agent": "Tessera", "note": "..." }` |
| POST | `/v1/propose_page_change` | `{ "path": "mesh/roles.md", "content": "...", "summary": "..." }` |
| GET or POST | `/v1/recent_changes` | none |
| POST | `/v1/route_task` | `{ "description": "review gate before publish" }` |

Success is `{ "ok": true, "data": ... }`. Failure is `{ "ok": false, "error": "..." }` with status 400, or 503 when the token is missing.

Example:

```bash
curl -s http://127.0.0.1:8787/v1/recent_changes
curl -s http://127.0.0.1:8787/v1/route_task \
  -H 'content-type: application/json' \
  -d '{"description":"historical comparison of merge pages"}'
```

## Tests

Tests mock `fetch`. They do not call GitHub and they do not need a token.

```bash
pnpm --filter @workspace/gitbook-mcp test
```

The root `pnpm test` command runs this package with the rest of the isolated suite.
