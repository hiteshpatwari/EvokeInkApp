[CmdletBinding()]
param(
    [ValidateScript({
        $uri = [uri]$_
        $uri.Scheme -eq 'https' -and
        -not $uri.UserInfo -and
        -not $uri.Query -and
        -not $uri.Fragment -and
        $uri.AbsolutePath -eq '/api/prompts'
    })]
    [string]$PromptApiUrl = 'https://evokeink.hiteshpatwari.com/api/prompts',

    [ValidateSet('Release', 'Debug')]
    [string]$BuildType = 'Release',

    [switch]$Install
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $projectRoot 'mobile/android'
$gradleWrapper = if ($IsWindows) {
    Join-Path $androidRoot 'gradlew.bat'
} else {
    Join-Path $androidRoot 'gradlew'
}
$variant = $BuildType.ToLowerInvariant()
$apkPath = Join-Path $androidRoot "app/build/outputs/apk/$variant/app-$variant.apk"
$bundlePath = if ($BuildType -eq 'Release') {
    Join-Path $androidRoot 'app/build/outputs/bundle/release/app-release.aab'
} else {
    $null
}
$temporarySigningDirectory = $null
$locationPushed = $false

try {
if ($BuildType -eq 'Release') {
    $requiredSigningValues = @(
        'ANDROID_KEYSTORE_PASSWORD',
        'ANDROID_KEY_ALIAS',
        'ANDROID_KEY_PASSWORD'
    )
    foreach ($name in $requiredSigningValues) {
        if (-not [Environment]::GetEnvironmentVariable($name)) {
            throw "$name is required for a signed Android release. Use -BuildType Debug only for local QA."
        }
    }
    if (-not $env:ANDROID_KEYSTORE_FILE) {
        if (-not $env:ANDROID_KEYSTORE_BASE64) {
            throw 'ANDROID_KEYSTORE_FILE or ANDROID_KEYSTORE_BASE64 is required for a signed Android release.'
        }
        $temporarySigningDirectory = Join-Path ([IO.Path]::GetTempPath()) "evoke-ink-signing-$([guid]::NewGuid().ToString('N'))"
        New-Item -ItemType Directory -Path $temporarySigningDirectory | Out-Null
        $env:ANDROID_KEYSTORE_FILE = Join-Path $temporarySigningDirectory 'upload-keystore.jks'
        try {
            [IO.File]::WriteAllBytes(
                $env:ANDROID_KEYSTORE_FILE,
                [Convert]::FromBase64String($env:ANDROID_KEYSTORE_BASE64)
            )
        } catch {
            throw 'ANDROID_KEYSTORE_BASE64 is not valid base64.'
        }
    }
    if (-not (Test-Path -LiteralPath $env:ANDROID_KEYSTORE_FILE -PathType Leaf)) {
        throw 'ANDROID_KEYSTORE_FILE does not identify a readable keystore file.'
    }
}

if (-not (Test-Path -LiteralPath $gradleWrapper -PathType Leaf)) {
    throw "Android Gradle wrapper was not found at $gradleWrapper."
}

if (-not $env:JAVA_HOME -and $IsWindows) {
    $jdkRoot = Join-Path $env:ProgramFiles 'Microsoft'
    $jdk = Get-ChildItem -LiteralPath $jdkRoot -Directory -Filter 'jdk-21*' -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending |
        Select-Object -First 1
    if ($jdk) { $env:JAVA_HOME = $jdk.FullName }
}
if (-not $env:JAVA_HOME) {
    throw 'JAVA_HOME must point to a Java 21 JDK. Install Microsoft OpenJDK 21 or use actions/setup-java.'
}

if (-not $env:ANDROID_HOME -and $IsWindows) {
    $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android/Sdk'
}
if (-not $env:ANDROID_HOME -or -not (Test-Path -LiteralPath $env:ANDROID_HOME -PathType Container)) {
    throw 'ANDROID_HOME must point to an installed Android SDK.'
}

$env:VITE_PROMPT_API_URL = $PromptApiUrl
Push-Location $projectRoot
$locationPushed = $true
    & corepack pnpm mobile:build
    if ($LASTEXITCODE -ne 0) { throw 'Mobile web build failed.' }

    & corepack pnpm mobile:sync
    if ($LASTEXITCODE -ne 0) { throw 'Capacitor Android synchronization failed.' }

    if (-not $IsWindows) {
        & chmod '+x' $gradleWrapper
        if ($LASTEXITCODE -ne 0) { throw 'Could not make the Gradle wrapper executable.' }
    }
    if ($BuildType -eq 'Release') {
        & $gradleWrapper -p $androidRoot assembleRelease bundleRelease --no-daemon
    } else {
        & $gradleWrapper -p $androidRoot assembleDebug --no-daemon
    }
    if ($LASTEXITCODE -ne 0) { throw "Android $BuildType build failed." }

    if (-not (Test-Path -LiteralPath $apkPath -PathType Leaf)) {
        throw "Gradle succeeded but the expected APK was not found at $apkPath."
    }

    if ($bundlePath -and -not (Test-Path -LiteralPath $bundlePath -PathType Leaf)) {
        throw "Gradle succeeded but the expected AAB was not found at $bundlePath."
    }

    $artifactArguments = @('--artifact', $apkPath)
    if ($bundlePath) { $artifactArguments += @('--artifact', $bundlePath) }
    & corepack pnpm --filter '@evoke-ink/mobile' secrets:check -- @artifactArguments
    if ($LASTEXITCODE -ne 0) { throw 'Mobile artifact secret scan failed.' }

    $artifacts = @($apkPath)
    if ($bundlePath) { $artifacts += $bundlePath }
    $hashes = [ordered]@{}
    foreach ($artifact in $artifacts) {
        $hash = (Get-FileHash -LiteralPath $artifact -Algorithm SHA256).Hash.ToLowerInvariant()
        $hashPath = "$artifact.sha256"
        Set-Content -LiteralPath $hashPath -Value "$hash  $(Split-Path -Leaf $artifact)" -Encoding utf8NoBOM
        $hashes[(Split-Path -Leaf $artifact)] = $hash
    }

    $installedDevice = $null
    if ($Install) {
        $adbCommand = Get-Command adb -ErrorAction SilentlyContinue
        $adbPath = if ($adbCommand) {
            $adbCommand.Source
        } else {
            Join-Path $env:ANDROID_HOME "platform-tools/$(if ($IsWindows) { 'adb.exe' } else { 'adb' })"
        }
        if (-not (Test-Path -LiteralPath $adbPath -PathType Leaf)) {
            throw 'ADB was not found. Install Android SDK Platform-Tools or add adb to PATH.'
        }

        $devices = @(& $adbPath devices) |
            Select-Object -Skip 1 |
            Where-Object { $_ -match "\tdevice$" } |
            ForEach-Object { ($_ -split "\t")[0] }
        if ($devices.Count -ne 1) {
            throw "Install requires exactly one authorized Android device; found $($devices.Count)."
        }

        & $adbPath -s $devices[0] install -r $apkPath
        if ($LASTEXITCODE -ne 0) { throw 'ADB could not install the APK.' }
        & $adbPath -s $devices[0] shell monkey -p app.evokeink.mobile -c android.intent.category.LAUNCHER 1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'The APK installed, but Android could not launch it.' }
        $installedDevice = $devices[0]
    }

    [ordered]@{
        ok = $true
        apk = $apkPath
        bundle = $bundlePath
        sha256 = $hashes
        buildType = $BuildType
        installedDevice = $installedDevice
        promptApiUrl = $PromptApiUrl
    } | ConvertTo-Json -Compress
} finally {
    if ($locationPushed) { Pop-Location }
    if ($temporarySigningDirectory -and (Test-Path -LiteralPath $temporarySigningDirectory)) {
        $resolvedTemporarySigningDirectory = [IO.Path]::GetFullPath($temporarySigningDirectory)
        $resolvedTemporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar)
        if (
            [IO.Path]::GetDirectoryName($resolvedTemporarySigningDirectory) -eq $resolvedTemporaryRoot -and
            [IO.Path]::GetFileName($resolvedTemporarySigningDirectory).StartsWith('evoke-ink-signing-')
        ) {
            Remove-Item -LiteralPath $resolvedTemporarySigningDirectory -Recurse -Force
        }
    }
}
