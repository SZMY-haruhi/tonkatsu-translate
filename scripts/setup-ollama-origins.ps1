#Requires -Version 5.0
<#
.SYNOPSIS
  One-time setup so Chrome/Edge extensions can call local Ollama.

.DESCRIPTION
  Sets the current Windows user environment variable OLLAMA_ORIGINS=*
  (same value on every machine). Then quit Ollama from the tray and
  reopen it so the new value is picked up.

  This cannot be done by the extension zip itself — OS env vars require
  a one-time host-side step. Run this script, or set the variable manually.
#>

$ErrorActionPreference = 'Stop'
$name = 'OLLAMA_ORIGINS'
$value = '*'

[System.Environment]::SetEnvironmentVariable($name, $value, 'User')
$env:OLLAMA_ORIGINS = $value

Write-Host ""
Write-Host "OK: user environment $name=$value"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1) Quit Ollama completely from the system tray."
Write-Host "  2) Start Ollama again."
Write-Host "  3) In Tonkatsu Translate control panel -> Local model -> Test connection."
Write-Host ""
Write-Host "Optional check (should print 200 after restart):"
Write-Host '  curl.exe -s -o NUL -w "%{http_code}" -X POST http://127.0.0.1:11434/api/tags -H "Origin: chrome-extension://test"'
Write-Host ""
