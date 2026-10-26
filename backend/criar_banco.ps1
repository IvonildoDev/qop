<#
  Cria o usuário e o banco do QOP no PostgreSQL e gera o backend\.env.
  Pode ser executado mais de uma vez: o que já existe é mantido.

  Uso (no PowerShell, dentro da pasta backend):
    .\criar_banco.ps1
    .\criar_banco.ps1 -Porta 5432          # se o Postgres estiver em outra porta
#>
param(
    [string]$PgBin = "C:\Program Files\PostgreSQL\18\bin",
    [int]$Porta = 5433,
    [string]$DbHost = "localhost",
    [string]$AdminPg = "postgres",
    [string]$Banco = "qop",
    [string]$Usuario = "qop_user"
)

$ErrorActionPreference = "Stop"
$psql = Join-Path $PgBin "psql.exe"
if (-not (Test-Path $psql)) { throw "psql.exe não encontrado em $PgBin" }

function ConverterTexto([System.Security.SecureString]$s) {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

$senhaAdmin = ConverterTexto (Read-Host "Senha do usuário '$AdminPg' do PostgreSQL" -AsSecureString)
$senhaNova  = ConverterTexto (Read-Host "Senha a definir para '$Usuario' (nova)" -AsSecureString)
if (-not $senhaNova) { throw "A senha do novo usuário não pode ser vazia." }

$env:PGPASSWORD = $senhaAdmin
$env:PGCLIENTENCODING = "UTF8"

function Sql([string]$comando, [string]$db = "postgres") {
    $r = & $psql -h $DbHost -p $Porta -U $AdminPg -d $db -v ON_ERROR_STOP=1 -tA -c $comando
    if ($LASTEXITCODE -ne 0) { throw "Falha ao executar no PostgreSQL (porta $Porta)." }
    ($r | Out-String).Trim()
}

try {
    Write-Host "Conectando em ${DbHost}:$Porta ..."
    $versao = Sql "SHOW server_version;"
    Write-Host "PostgreSQL $versao"

    $senhaSql = $senhaNova.Replace("'", "''")

    if ((Sql "SELECT 1 FROM pg_roles WHERE rolname = '$Usuario';") -eq "1") {
        Write-Host "Usuário '$Usuario' já existe: atualizando a senha."
        Sql "ALTER USER $Usuario WITH PASSWORD '$senhaSql';" | Out-Null
    } else {
        Sql "CREATE USER $Usuario WITH PASSWORD '$senhaSql';" | Out-Null
        Write-Host "Usuário '$Usuario' criado."
    }

    if ((Sql "SELECT 1 FROM pg_database WHERE datname = '$Banco';") -eq "1") {
        Write-Host "Banco '$Banco' já existe: mantido."
    } else {
        Sql "CREATE DATABASE $Banco OWNER $Usuario ENCODING 'UTF8' TEMPLATE template0;" | Out-Null
        Write-Host "Banco '$Banco' criado."
    }
    Sql "GRANT ALL ON SCHEMA public TO $Usuario;" $Banco | Out-Null
}
finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

# Gera o .env (sem sobrescrever um existente)
$envPath = Join-Path $PSScriptRoot ".env"
if (Test-Path $envPath) {
    Write-Host ".env já existe: não foi alterado. Confira se DATABASE_URL está correto."
} else {
    $bytes = New-Object byte[] 48
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $chave = [Convert]::ToBase64String($bytes)
    $senhaUrl = [Uri]::EscapeDataString($senhaNova)
    $conteudo = @"
DATABASE_URL=postgresql+psycopg://${Usuario}:${senhaUrl}@${DbHost}:${Porta}/${Banco}
SECRET_KEY=$chave
ACCESS_TOKEN_DAYS=7
UPLOAD_DIR=../uploads_v2
"@
    [IO.File]::WriteAllText($envPath, $conteudo, (New-Object Text.UTF8Encoding($false)))
    Write-Host ".env criado em $envPath"
}

Write-Host "`nPronto. Avise o Claude para criar as tabelas."
