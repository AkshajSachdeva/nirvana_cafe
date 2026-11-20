$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$mysqlBase = 'C:\Program Files\MySQL\MySQL Server 8.0'
$mysqld = Join-Path $mysqlBase 'bin\mysqld.exe'
$dataDir = Join-Path $projectRoot '.mysql\data'
$port = 3307

if (-not (Test-Path $dataDir)) {
  throw "Local database is not initialized. Run scripts/init-local-mysql.ps1 first."
}
if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
  Write-Output "MySQL is already listening on 127.0.0.1:$port"
  exit 0
}
if (-not (Test-Path $mysqld)) { throw "MySQL server binary not found at $mysqld" }
$mysqlArgs = @('--no-defaults', "--basedir=$mysqlBase", "--datadir=$dataDir", "--port=$port", '--bind-address=127.0.0.1', '--mysqlx=0', "--log-error=$(Join-Path $projectRoot '.mysql\mysql.log')")
Start-Process -FilePath $mysqld -ArgumentList $mysqlArgs -WindowStyle Hidden | Out-Null
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
    Write-Output "MySQL is ready on 127.0.0.1:$port"
    exit 0
  }
}
throw "MySQL did not start. See $projectRoot\.mysql\mysql.log"
