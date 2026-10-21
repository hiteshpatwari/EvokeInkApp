[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('production')]
    [string]$Environment,

    [Parameter(Mandatory = $true)]
    [ValidateSet('read-and-reflect')]
    [string]$WorkerName,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-fA-F-]{16,64}$')]
    [string]$VerifiedVersionId,

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
$expectedTarget = "$Environment/$WorkerName/$VerifiedVersionId"
if ($ConfirmTarget -cne $expectedTarget) {
    throw "ConfirmTarget must exactly equal '$expectedTarget'."
}

$plan = [ordered]@{
    action = 'rollback'
    environment = $Environment
    worker = $WorkerName
    version = $VerifiedVersionId
    probe = $ProbeBaseUrl
    dryRun = -not $Execute
}

if (-not $Execute) {
    $plan | ConvertTo-Json -Compress
    exit 0
}

if (-not $PSCmdlet.ShouldProcess($expectedTarget, 'route 100 percent to the verified version and run synthetic probe')) {
    exit 0
}

$versions = ConvertTo-Json @(@{ version_id = $VerifiedVersionId; percentage = 100 }) -Compress
& pnpm exec cf workers deployments create --worker $WorkerName --versions $versions
if ($LASTEXITCODE -ne 0) { throw 'rollback deployment failed.' }
& "$PSScriptRoot/Invoke-SyntheticProbe.ps1" -BaseUrl $ProbeBaseUrl -AllowedOrigin $AllowedOrigin
if ($LASTEXITCODE -ne 0) { throw 'post-rollback synthetic probe failed.' }
