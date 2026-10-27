[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('production')]
    [string]$Environment,

    [Parameter(Mandatory = $true)]
    [ValidateSet('evoke-ink-app')]
    [string]$WorkerName,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https://[^/]+$')]
    [string]$AllowedOrigin,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https://[^/]+$')]
    [string]$ProbeBaseUrl,

    [Parameter(Mandatory = $true)]
    [string]$ConfirmTarget,

    [switch]$Execute
)

$ErrorActionPreference = 'Stop'
$expectedTarget = "$Environment/$WorkerName"
if ($ConfirmTarget -cne $expectedTarget) {
    throw "ConfirmTarget must exactly equal '$expectedTarget'."
}

$plan = [ordered]@{
    action = 'mock_failover'
    environment = $Environment
    worker = $WorkerName
    provider = 'mock'
    allowedOrigin = $AllowedOrigin
    probe = $ProbeBaseUrl
    dryRun = -not $Execute
}

if (-not $Execute) {
    $plan | ConvertTo-Json -Compress
    exit 0
}

if (-not $PSCmdlet.ShouldProcess($expectedTarget, 'build, deploy in mock mode, and run synthetic probe')) {
    exit 0
}

$previousProvider = $env:AI_PROVIDER
$previousOrigins = $env:APP_ALLOWED_ORIGINS
try {
    $env:AI_PROVIDER = 'mock'
    $env:APP_ALLOWED_ORIGINS = $AllowedOrigin
    & pnpm build:vinext
    if ($LASTEXITCODE -ne 0) { throw 'vinext build failed; deployment was not attempted.' }
    & pnpm deploy:vinext
    if ($LASTEXITCODE -ne 0) { throw 'mock deployment failed.' }
    & "$PSScriptRoot/Invoke-SyntheticProbe.ps1" -BaseUrl $ProbeBaseUrl -AllowedOrigin $AllowedOrigin
    if ($LASTEXITCODE -ne 0) { throw 'post-failover synthetic probe failed.' }
} finally {
    $env:AI_PROVIDER = $previousProvider
    $env:APP_ALLOWED_ORIGINS = $previousOrigins
}
