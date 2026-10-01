# parar-tempo.ps1 -- fecha o Tempo e mata os processos node deste projeto.
#
#   powershell -ExecutionPolicy Bypass -File scripts\parar-tempo.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\parar-tempo.ps1 -Tudo
#
#   -Tudo   mata TODOS os node.exe da maquina, nao so os deste projeto.
#
# Correr numa janela PowerShell externa: se correr dentro de um terminal
# do Tempo, o proprio script morre quando o Tempo e fechado.

param(
  [switch]$Tudo,
  [string]$Raiz
)

$ErrorActionPreference = 'SilentlyContinue'

# Raiz do projeto: -Raiz quando chamado de fora, senao derivada da localizacao
# do script (assim sobrevive a renames da pasta).
if ($Raiz) { $raiz = $Raiz.TrimEnd('\') }
else       { $raiz = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path.TrimEnd('\') }

function Get-NodesAlvo {
  $procs = Get-CimInstance Win32_Process -Filter "Name like 'node%' or Name like 'pnpm%' or Name like 'esbuild%'"
  if ($Tudo) { return @($procs) }
  return @($procs | Where-Object {
    $_.CommandLine -like "*$raiz*" -or $_.ExecutablePath -like "$raiz*"
  })
}

function Abater($lista, $titulo) {
  Write-Host ""
  Write-Host "== $titulo : $($lista.Count) ==" -ForegroundColor Green
  foreach ($p in $lista) {
    $cmd = $p.CommandLine
    if ([string]::IsNullOrWhiteSpace($cmd)) { $cmd = $p.Name }
    if ($cmd.Length -gt 70) { $cmd = $cmd.Substring(0, 70) }
    Write-Host ("  {0,-6} {1}" -f $p.ProcessId, $cmd)
    Stop-Process -Id $p.ProcessId -Force
  }
}

# --- 1a passagem -------------------------------------------------------------
$alvos = Get-NodesAlvo
if ($alvos.Count -eq 0) {
  Write-Host ""
  Write-Host "== node a abater: 0 ==" -ForegroundColor Green
} else {
  Abater $alvos 'node a abater'
}

# --- 2a passagem (sobreviventes) ---------------------------------------------
Start-Sleep -Milliseconds 800
$restantes = Get-NodesAlvo
if ($restantes.Count -gt 0) {
  Write-Host "AVISO: sobraram $($restantes.Count) node - a forcar segunda passagem." -ForegroundColor Yellow
  Abater $restantes 'node a abater (2a passagem)'
  Start-Sleep -Milliseconds 800
}

# --- Tempo -------------------------------------------------------------------
Write-Host "== a fechar o Tempo ==" -ForegroundColor Green
foreach ($volta in 1..3) {
  $tempo = @(Get-Process -Name 'Tempo')
  if ($tempo.Count -eq 0) { break }
  $tempo | Stop-Process -Force
  Start-Sleep -Milliseconds 800
}

# --- estado final ------------------------------------------------------------
Start-Sleep -Milliseconds 500
$nodesVivos = @(Get-Process -Name 'node').Count
$tempoVivos = @(Get-Process -Name 'Tempo').Count
$os         = Get-CimInstance Win32_OperatingSystem
$livreMB    = [math]::Round($os.FreePhysicalMemory / 1KB)
$totalMB    = [math]::Round($os.TotalVisibleMemorySize / 1KB)

Write-Host ""
Write-Host "== estado final ==" -ForegroundColor Green
Write-Host ("  node.exe vivos : {0}" -f $nodesVivos) -ForegroundColor $(if ($nodesVivos -eq 0) { 'Green' } else { 'Yellow' })
Write-Host ("  Tempo vivos    : {0}" -f $tempoVivos) -ForegroundColor $(if ($tempoVivos -eq 0) { 'Green' } else { 'Yellow' })
Write-Host ("  RAM livre      : {0} MB de {1} MB" -f $livreMB, $totalMB)

if ($nodesVivos -gt 0 -and -not $Tudo) {
  Write-Host ""
  Write-Host "Os node.exe restantes nao pertencem a este projeto." -ForegroundColor DarkGray
  Write-Host "Para os matar tambem: scripts\parar-tempo.ps1 -Tudo" -ForegroundColor DarkGray
}
