[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$CommandArgs
)

$ErrorActionPreference = "Stop"

if (-not $CommandArgs -or $CommandArgs.Count -eq 0) {
  Write-Host "Uso: .\scripts\sb.ps1 <comando supabase>"
  Write-Host "Exemplo: .\scripts\sb.ps1 db push"
  exit 1
}

function Get-RepoRoot {
  $gitRoot = (& git rev-parse --show-toplevel 2>$null)
  if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($gitRoot)) {
    return $gitRoot.Trim()
  }
  return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Get-EnvValue {
  param([string]$Name)
  if ([string]::IsNullOrWhiteSpace($Name)) { return $null }
  $v = [Environment]::GetEnvironmentVariable($Name, "Process")
  if (-not $v) { $v = [Environment]::GetEnvironmentVariable($Name, "User") }
  if (-not $v) { $v = [Environment]::GetEnvironmentVariable($Name, "Machine") }
  return $v
}

$repoRoot = Get-RepoRoot
$contextPath = Join-Path $repoRoot ".supabase-context.json"

if (-not (Test-Path $contextPath)) {
  Write-Error "Arquivo .supabase-context.json nao encontrado em $repoRoot. Copie .supabase-context.example.json e ajuste."
}

$ctx = Get-Content $contextPath -Raw | ConvertFrom-Json
$profile = [string]$ctx.profile
$projectRef = [string]$ctx.project_ref
$dbPasswordEnv = [string]$ctx.db_password_env
$autoLinkDbCommands = if ($null -eq $ctx.auto_link_db_commands) { $true } else { [bool]$ctx.auto_link_db_commands }

if ([string]::IsNullOrWhiteSpace($profile)) {
  Write-Error "Campo 'profile' obrigatorio em .supabase-context.json"
}
if ([string]::IsNullOrWhiteSpace($projectRef)) {
  Write-Error "Campo 'project_ref' obrigatorio em .supabase-context.json"
}

$dbPassword = Get-EnvValue -Name $dbPasswordEnv

$arg0 = $CommandArgs[0].ToLowerInvariant()
$arg1 = if ($CommandArgs.Count -gt 1) { $CommandArgs[1].ToLowerInvariant() } else { "" }
$needsLink = (
  ($arg0 -eq "db" -and @("push", "pull", "dump") -contains $arg1) -or
  ($arg0 -eq "migration" -and @("list", "repair") -contains $arg1)
)

$hasProfileFlag = $CommandArgs -contains "--profile"
$hasWorkdirFlag = $CommandArgs -contains "--workdir"

if ($autoLinkDbCommands -and $needsLink) {
  $linkArgs = @("link", "--project-ref", $projectRef, "--profile", $profile, "--workdir", $repoRoot)
  if (-not [string]::IsNullOrWhiteSpace($dbPassword)) {
    $linkArgs += @("--password", $dbPassword)
  }
  & supabase @linkArgs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$baseArgs = @()
if (-not $hasProfileFlag) {
  $baseArgs += @("--profile", $profile)
}
if (-not $hasWorkdirFlag) {
  $baseArgs += @("--workdir", $repoRoot)
}

& supabase @baseArgs @CommandArgs
exit $LASTEXITCODE

