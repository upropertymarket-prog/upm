# renomear-para-upm.ps1 -- para o Tempo, mata os node deste projeto,
# renomeia a pasta para "upm" e relanca o Tempo.
#
#   cd C:\Users\alexa\tempo\projects
#   powershell -ExecutionPolicy Bypass -File .\document-analysis\scripts\renomear-para-upm.ps1
#
# TEM de correr numa PowerShell externa e com o cwd FORA da pasta do projeto:
# o current directory de um processo segura um handle na pasta e bloqueia o rename.

param(
  [string]$NovoNome = 'upm',
  [switch]$Relocado,
  [string]$RaizOriginal
)

$ErrorActionPreference = 'Stop'

$tempoExe = 'C:\Users\alexa\AppData\Local\Programs\tempo-electron\Tempo.exe'

# ---------------------------------------------------------------------------
# Fase 1: ainda dentro do projeto -- validar e relocalizar para o TEMP.
# ---------------------------------------------------------------------------
if (-not $Relocado) {
  $raiz = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path.TrimEnd('\')
  $pai  = Split-Path $raiz -Parent
  $novo = Join-Path $pai $NovoNome

  if (Test-Path $novo) {
    Write-Host "ERRO: o destino ja existe -> $novo" -ForegroundColor Red
    exit 1
  }

  if ($PWD.Path.TrimEnd('\') -like "$raiz*") {
    Write-Host ""
    Write-Host "ERRO: estas dentro da pasta que vai ser renomeada." -ForegroundColor Red
    Write-Host "O cwd desta shell segura um handle e o rename falha. Sai primeiro:" -ForegroundColor Yellow
    Write-Host "  cd $pai" -ForegroundColor Yellow
    Write-Host "  powershell -ExecutionPolicy Bypass -File .\$(Split-Path $raiz -Leaf)\scripts\renomear-para-upm.ps1" -ForegroundColor Yellow
    exit 1
  }

  # Copiar os scripts para o TEMP: assim nao fica nenhum handle aberto
  # sobre ficheiros dentro da pasta a renomear.
  $tmp = Join-Path $env:TEMP ("renomear-upm-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  Copy-Item (Join-Path $PSScriptRoot 'parar-tempo.ps1')        (Join-Path $tmp 'parar-tempo.ps1')
  Copy-Item $PSCommandPath                                      (Join-Path $tmp 'renomear-para-upm.ps1')

  Write-Host "A correr a partir de $tmp (fora da pasta a renomear)..." -ForegroundColor DarkGray

  & powershell -ExecutionPolicy Bypass -File (Join-Path $tmp 'renomear-para-upm.ps1') `
      -Relocado -RaizOriginal $raiz -NovoNome $NovoNome
  exit $LASTEXITCODE
}

# ---------------------------------------------------------------------------
# Fase 2: a correr do TEMP -- pode mexer na pasta com seguranca.
# ---------------------------------------------------------------------------
Set-Location $env:TEMP

$raiz = $RaizOriginal.TrimEnd('\')
$pai  = Split-Path $raiz -Parent
$novo = Join-Path $pai $NovoNome

# 1. Parar o Tempo e os node deste projeto (reutiliza o script ja existente).
& (Join-Path $PSScriptRoot 'parar-tempo.ps1') -Raiz $raiz

# 2. Rename, com tentativas: os watchers do Next/Vite largam os handles com atraso.
Write-Host ""
Write-Host "== a renomear ==" -ForegroundColor Green
Write-Host "  $raiz"
Write-Host "  -> $novo"

$ok = $false
foreach ($tentativa in 1..15) {
  try {
    Rename-Item -LiteralPath $raiz -NewName $NovoNome -ErrorAction Stop
    $ok = $true
    break
  } catch {
    Write-Host ("  bloqueado, tentativa {0}/15..." -f $tentativa) -ForegroundColor DarkYellow
    Start-Sleep -Seconds 2
  }
}

if (-not $ok) {
  Write-Host ""
  Write-Host "RENAME BLOQUEADO -- algo continua a segurar a pasta." -ForegroundColor Red
  Write-Host "Processos ainda vivos com referencia ao caminho:" -ForegroundColor Yellow
  Get-CimInstance Win32_Process |
    Where-Object { $_.CommandLine -like "*$raiz*" -or $_.ExecutablePath -like "$raiz*" } |
    Select-Object ProcessId, Name, CommandLine | Format-List
  Write-Host "Podes tentar: scripts\parar-tempo.ps1 -Tudo   (mata TODOS os node da maquina)" -ForegroundColor Yellow
  exit 1
}

Write-Host "  OK" -ForegroundColor Green

# 3. Renomear o estado do Claude Code, que e indexado pelo caminho do projeto.
#    Sem isto, o historico de chats e as memorias ficam orfaos.
Write-Host ""
Write-Host "== estado do Claude Code ==" -ForegroundColor Green
$claudeBase = Join-Path $env:USERPROFILE '.claude\projects'
$chaveAntiga = $raiz -replace '[:\\]', '-'
$chaveNova   = $novo -replace '[:\\]', '-'
$dirAntigo = Join-Path $claudeBase $chaveAntiga
$dirNovo   = Join-Path $claudeBase $chaveNova

if (-not (Test-Path $dirAntigo)) {
  Write-Host "  nada a mover ($chaveAntiga nao existe)" -ForegroundColor DarkGray
} elseif (Test-Path $dirNovo) {
  Write-Host "  ATENCAO: $chaveNova ja existe -- deixado como esta." -ForegroundColor Yellow
  Write-Host "  O historico antigo fica em $dirAntigo" -ForegroundColor Yellow
} else {
  try {
    Rename-Item -LiteralPath $dirAntigo -NewName $chaveNova -ErrorAction Stop
    Write-Host "  $chaveAntiga" -ForegroundColor DarkGray
    Write-Host "  -> $chaveNova" -ForegroundColor Green
  } catch {
    Write-Host "  falhou: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "  historico e memorias ficam em $dirAntigo" -ForegroundColor Yellow
  }
}

# 4. Relancar o Tempo.
Write-Host ""
Write-Host "== a relancar o Tempo ==" -ForegroundColor Green
if (Test-Path $tempoExe) {
  Start-Process $tempoExe
  Write-Host "  lancado" -ForegroundColor Green
} else {
  Write-Host "  Tempo.exe nao encontrado em $tempoExe -- abre manualmente." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Feito. A pasta e agora $novo" -ForegroundColor Green
Write-Host "O workspace do Tempo guardava o caminho antigo: se o projeto aparecer" -ForegroundColor Yellow
Write-Host "em falta, reabre-o a partir de $novo" -ForegroundColor Yellow
