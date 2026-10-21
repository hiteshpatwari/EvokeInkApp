[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateScript({ ([uri]$_).Scheme -eq 'https' -or ([uri]$_).Host -in @('localhost', '127.0.0.1') })]
    [string]$BaseUrl,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https?://[^/]+$')]
    [string]$AllowedOrigin
)

$ErrorActionPreference = 'Stop'
$base = $BaseUrl.TrimEnd('/')
$result = [ordered]@{
    ok = $false
    web = $false
    health = $false
    prompt = $false
    errors = @()
}

function Add-ProbeError([string]$Message) {
    $result.errors += $Message
}

try {
    $webResponse = Invoke-WebRequest -Uri "$base/" -Method Get -SkipHttpErrorCheck
    $result.web = $webResponse.StatusCode -eq 200
    if (-not $result.web) { Add-ProbeError "web_status_$($webResponse.StatusCode)" }
} catch {
    Add-ProbeError 'web_request_failed'
}

try {
    $healthResponse = Invoke-WebRequest -Uri "$base/api/health" -Method Get -SkipHttpErrorCheck
    $healthBody = $healthResponse.Content | ConvertFrom-Json
    $result.health = $healthResponse.StatusCode -eq 200 -and
        $healthResponse.Headers['Cache-Control'] -contains 'no-store' -and
        $healthBody.status -eq 'ok'
    if (-not $result.health) { Add-ProbeError 'health_contract_failed' }
} catch {
    Add-ProbeError 'health_request_failed'
}

$payload = @{
    child = @{
        gradeOrAge = 'Adult'
        difficulty = 'grade_level'
        responseLength = 'short'
    }
    book = @{
        title = 'Synthetic Test Book'
        author = 'Synthetic Test Author'
        genre = 'fiction'
        progress = 'Chapter 1'
    }
    specificity = 'general'
    skills = @('inference')
    parentNotes = ''
    parentSummary = ''
    detailNotes = ''
} | ConvertTo-Json -Depth 5 -Compress

try {
    $headers = @{
        Origin = $AllowedOrigin
        'X-Installation-Token' = '00000000-0000-4000-8000-000000000009'
    }
    $promptResponse = Invoke-WebRequest -Uri "$base/api/prompts" -Method Post -ContentType 'application/json' -Headers $headers -Body $payload -SkipHttpErrorCheck
    $promptBody = $promptResponse.Content | ConvertFrom-Json
    $requiredCount = @($promptBody.prompts | Where-Object { $_.required -eq $true }).Count
    $validPromptCount = @($promptBody.prompts | Where-Object {
        $_.text -is [string] -and $_.text.Length -ge 15 -and
        $_.skill -is [string] -and $_.skill.Length -ge 2 -and
        $_.explanation -is [string] -and $_.explanation.Length -ge 8 -and
        $_.required -is [bool] -and
        $_.suggestedResponseLength -is [string] -and
        $_.grounding -in @('generic', 'parent_notes', 'parent_summary') -and
        $_.difficultyLevel -in @('accessible', 'grade_level', 'challenging', 'advanced')
    }).Count
    $result.prompt = $promptResponse.StatusCode -eq 200 -and
        $promptResponse.Headers['Cache-Control'] -contains 'no-store' -and
        @($promptBody.prompts).Count -eq 4 -and
        $validPromptCount -eq 4 -and
        $requiredCount -eq 3 -and
        $promptBody.provider -eq 'mock' -and
        $promptBody.fallback -eq $false
    if (-not $result.prompt) { Add-ProbeError 'prompt_contract_failed' }
} catch {
    Add-ProbeError 'prompt_request_failed'
}

$result.ok = $result.web -and $result.health -and $result.prompt
$result | ConvertTo-Json -Compress
if (-not $result.ok) { exit 1 }
