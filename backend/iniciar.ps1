<#
  Inicia o QOP (API + telas) em http://localhost:8000
  Uso: .\iniciar.ps1
  Para parar: Ctrl+C
#>
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".env")) { throw "Falta o arquivo backend\.env (veja .env.example)." }

$svc = Get-Service "postgresql-x64-18" -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -ne "Running") {
    Write-Host "Iniciando o PostgreSQL 18..."
    Start-Service $svc.Name
}

.\.venv\Scripts\alembic.exe upgrade head
Write-Host "`nQOP em http://localhost:8000  (Ctrl+C para parar)`n"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
