$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$prefix = 'http://localhost:8001/'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try { $listener.Start() } catch { Write-Host "Could not start on $prefix : $_"; Read-Host 'Press Enter to exit'; exit 1 }
Write-Host "============================================================"
Write-Host " Avoxan local server"
Write-Host " Serving: $root"
Write-Host " Open:    $prefix index.html"
Write-Host " Stop:    close this window"
Write-Host "============================================================"
$mimes = @{ '.html'='text/html; charset=utf-8'; '.css'='text/css'; '.js'='application/javascript'; '.mjs'='application/javascript'; '.json'='application/json'; '.svg'='image/svg+xml'; '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.webp'='image/webp'; '.gif'='image/gif'; '.ico'='image/x-icon'; '.mp4'='video/mp4'; '.webm'='video/webm'; '.mp3'='audio/mpeg'; '.xml'='application/xml'; '.webmanifest'='application/manifest+json'; '.woff2'='font/woff2'; '.woff'='font/woff'; '.txt'='text/plain' }
while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $rel = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
    if ($rel -eq '') { $rel = 'index.html' }
    $path = Join-Path $root $rel
    if (Test-Path $path -PathType Container) { $path = Join-Path $path 'index.html' }
    if (-not (Test-Path $path -PathType Leaf)) {
      if (Test-Path ($path + '.html') -PathType Leaf) { $path = $path + '.html' }
    }
    if (Test-Path $path -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($path).ToLower()
      $ct = $mimes[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $res.ContentType = $ct
      $res.Headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
      $b = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found: ' + $rel)
      $res.OutputStream.Write($b, 0, $b.Length)
    }
    $res.OutputStream.Close()
  } catch { }
}
