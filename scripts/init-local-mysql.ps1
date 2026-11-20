$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$mysqlBase = 'C:\Program Files\MySQL\MySQL Server 8.0'
$mysqld = Join-Path $mysqlBase 'bin\mysqld.exe'
$dataDir = Join-Path $projectRoot '.mysql\data'
if (Test-Path $dataDir) { throw "Refusing to overwrite existing project database at $dataDir" }
if (-not (Test-Path $mysqld)) { throw "MySQL server binary not found at $mysqld" }
New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot '.mysql') | Out-Null
& $mysqld --no-defaults --initialize-insecure "--basedir=$mysqlBase" "--datadir=$dataDir" --console
if ($LASTEXITCODE -ne 0) { throw 'MySQL initialization failed.' }
Write-Output 'Initialized the isolated project database. Start it with scripts/start-local-mysql.ps1.'
