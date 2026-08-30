# Refero CLI

`refero` is a small command-line client for the Refero MCP server. It exposes Refero’s current research layers—styles, screens, and flows—without requiring an MCP-enabled editor.

## Install

```sh
npm install -g refero-mcp-cli
```

The package is currently intended for private/internal distribution. To install a checkout directly:

```sh
npm install -g .
```

## Configure

The easiest setup is the browser login flow:

```sh
refero auth login
refero auth status
```

The CLI opens Refero in your browser, completes an authorization-code + PKCE sign-in through a local callback, and stores the resulting credentials in the per-user config directory. It refreshes an expired access token when a refresh token is available. For CI or an already-issued token, set a Refero bearer token in your shell instead:

```powershell
$env:REFERO_TOKEN = "your-token"
```

Use `refero auth logout` to remove the saved credentials. `REFERO_TOKEN` and `--token` take precedence over saved credentials.

The endpoint can be overridden with `REFERO_MCP_URL` for testing or a compatible proxy. The default is `https://api.refero.design/mcp`.

## Examples

```sh
refero search styles "editorial monochrome SaaS landing page"
refero search screens "pricing page annual monthly toggle" --platform web --json
refero search flows "subscription cancellation with retention offer" --platform web
refero get style 707c2922-e428-4ee4-847c-9791290712d1
refero get screen 20c61554-3c93-4848-aeb1-e3c1ba62d99d --json
refero similar 20c61554-3c93-4848-aeb1-e3c1ba62d99d --limit 5
refero image 20c61554-3c93-4848-aeb1-e3c1ba62d99d --size thumbnail --output ./reference.png
```

Searches and detail calls default to Markdown because that is the most useful format for a terminal and an AI workflow. Add `--json` for scripts and pipelines. Screen and flow searches require `--platform web` or `--platform ios`, matching the MCP API.

## Development

```sh
npm test
npm start -- search styles "developer tool dark technical" --json
```

The client uses Node’s built-in `fetch` and test runner, so there are no runtime dependencies.

## Notes

This project is a client for the Refero MCP endpoint. It does not mirror Refero’s catalog, bypass authentication, or redistribute screenshots.

## License

MIT
