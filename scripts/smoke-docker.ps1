# Docker smoke test for the containerized stack (task #49).
#
# Verifies the single-origin frontend container: static SPA, deep-route
# fallback, /api proxying to the backend, and the WebSocket upgrade path.
# Run it after `docker compose up --build -d --wait`.
#
# Usage: .\scripts\smoke-docker.ps1 [-BaseUrl http://localhost:8080]
param(
  [string]$BaseUrl = 'http://localhost:8080',
  [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# Windows PowerShell 5.1 does not load System.Net.Http by default.
Add-Type -AssemblyName System.Net.Http

function Fail([string]$message) {
  Write-Error "FAIL: $message" -ErrorAction Continue
  exit 1
}

function Pass([string]$message) {
  Write-Host "ok: $message"
}

# HttpClient is needed for the WebSocket upgrade headers: they are restricted
# on Invoke-WebRequest / HttpWebRequest.
$handler = [System.Net.Http.HttpClientHandler]::new()
$handler.AllowAutoRedirect = $false
$client = [System.Net.Http.HttpClient]::new($handler)
$client.Timeout = [TimeSpan]::FromSeconds(10)

function Get-Status([string]$url) {
  $response = $client.GetAsync($url).GetAwaiter().GetResult()
  return @{
    Status  = [int]$response.StatusCode
    Content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  }
}

# 1. Backend reachability through the proxy (FastAPI + PostgreSQL).
Write-Host "waiting for $BaseUrl/api/health (timeout ${TimeoutSeconds}s)..."
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$health = ''
while ((Get-Date) -lt $deadline) {
  try {
    $result = Get-Status "$BaseUrl/api/health"
    $health = $result.Content
    if ($health -like '*"status":"ok"*' -and $health -like '*"db":"ok"*') { break }
  } catch {
    $health = ''
  }
  Start-Sleep -Seconds 2
}

if ($health -notlike '*"status":"ok"*') { Fail "health never reported status=ok (last: '$health')" }
if ($health -notlike '*"db":"ok"*') { Fail "health never reported db=ok (last: '$health')" }
Pass "GET /api/health -> $health"

# 2. SPA shell served by nginx.
$index = Get-Status "$BaseUrl/"
if ($index.Status -ne 200) { Fail "GET / -> $($index.Status), expected 200" }
if ($index.Content -notlike '*<div id="root">*') { Fail 'GET / is not the SPA shell' }
if ($index.Content -notlike '*type="module"*') { Fail 'GET / has no module script tag' }
Pass 'GET / returns the SPA shell'

# 3. Deep route falls back to index.html (React Router history mode).
$deep = Get-Status "$BaseUrl/rooms/smoke-test"
if ($deep.Status -ne 200) { Fail "deep route /rooms/smoke-test -> $($deep.Status), expected 200" }
Pass 'deep route /rooms/smoke-test falls back to index.html'

# 4. /api is proxied, not swallowed by the SPA fallback.
$missing = Get-Status "$BaseUrl/api/does-not-exist"
if ($missing.Status -ne 404) {
  Fail "/api/does-not-exist -> $($missing.Status), expected 404 from the backend"
}
Pass '/api/* is proxied to the backend'

# 5. WebSocket upgrade reaches the app on the same origin. No Origin header
#    means admission refuses with 403 invalid_origin *before* touching the
#    database, which proves nginx forwarded the upgrade, not a plain GET.
$request = [System.Net.Http.HttpRequestMessage]::new(
  [System.Net.Http.HttpMethod]::Get,
  "$BaseUrl/api/ws/rooms/00000000-0000-0000-0000-000000000000"
)
$request.Headers.TryAddWithoutValidation('Connection', 'Upgrade') | Out-Null
$request.Headers.TryAddWithoutValidation('Upgrade', 'websocket') | Out-Null
$request.Headers.TryAddWithoutValidation('Sec-WebSocket-Version', '13') | Out-Null
$request.Headers.TryAddWithoutValidation('Sec-WebSocket-Key', 'dGhlIHNhbXBsZSBub25jZQ==') | Out-Null
$ws = $client.SendAsync($request).GetAwaiter().GetResult()
$wsBody = $ws.Content.ReadAsStringAsync().GetAwaiter().GetResult()
$wsStatus = [int]$ws.StatusCode

if ($wsStatus -ne 403) {
  Fail "WS upgrade -> $wsStatus, expected 403 invalid_origin (payload: $wsBody)"
}
if ($wsBody -notlike '*invalid_origin*') {
  Fail "WS refusal has no invalid_origin payload (payload: $wsBody)"
}
Pass 'WS upgrade on /api/ws/* reaches the backend (403 invalid_origin)'

Write-Host "smoke: all checks passed against $BaseUrl"
