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

# Newer Supabase CLI versions treat --profile as a platform/profile selector.
# Older project setup instructions used "supabase login --name <value>" and then
# reused that token label as --profile, which now fails with
# "Unsupported Config Type". Only pass the context profile when it is the
# built-in "supabase" profile or an explicit YAML profile file.
$profileArgs = @()
if (-not $hasProfileFlag -and -not [string]::IsNullOrWhiteSpace($profile)) {
  $profilePath = $null
  try {
    $profilePath = Resolve-Path $profile -ErrorAction SilentlyContinue
  } catch {
    $profilePath = $null
  }

  $isYamlProfile = $null -ne $profilePath -and @(".yml", ".yaml") -contains [IO.Path]::GetExtension($profilePath.Path).ToLowerInvariant()
  if ($profile -eq "supabase" -or $isYamlProfile) {
    $profileArgs = @("--profile", $profile)
  } else {
    Write-Warning "Profile legado '$profile' ignorado. O Supabase CLI usara o profile padrao 'supabase'."
  }
}

if ($autoLinkDbCommands -and $needsLink) {
  $linkArgs = @("link", "--project-ref", $projectRef) + $profileArgs + @("--workdir", $repoRoot)
  if (-not [string]::IsNullOrWhiteSpace($dbPassword)) {
    $linkArgs += @("--password", $dbPassword)
  }
  & supabase @linkArgs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$baseArgs = @()
if (-not $hasProfileFlag) {
  $baseArgs += $profileArgs
}
if (-not $hasWorkdirFlag) {
  $baseArgs += @("--workdir", $repoRoot)
}

& supabase @baseArgs @CommandArgs
exit $LASTEXITCODE

