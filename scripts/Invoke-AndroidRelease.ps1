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
    [string]$PromptApiUrl = 'https://read-and-reflect.hiteshpatwari.workers.dev/api/prompts',

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
$apkPath = Join-Path $androidRoot 'app/build/outputs/apk/debug/app-debug.apk'

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
try {
    & corepack pnpm mobile:build
    if ($LASTEXITCODE -ne 0) { throw 'Mobile web build failed.' }

    & corepack pnpm mobile:sync
    if ($LASTEXITCODE -ne 0) { throw 'Capacitor Android synchronization failed.' }

    & corepack pnpm mobile:secrets
    if ($LASTEXITCODE -ne 0) { throw 'Mobile artifact secret scan failed.' }

    if (-not $IsWindows) {
        & chmod '+x' $gradleWrapper
        if ($LASTEXITCODE -ne 0) { throw 'Could not make the Gradle wrapper executable.' }
    }
    & $gradleWrapper -p $androidRoot assembleDebug --no-daemon
    if ($LASTEXITCODE -ne 0) { throw 'Android APK build failed.' }

    if (-not (Test-Path -LiteralPath $apkPath -PathType Leaf)) {
        throw "Gradle succeeded but the expected APK was not found at $apkPath."
    }

    $hash = (Get-FileHash -LiteralPath $apkPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $hashPath = "$apkPath.sha256"
    Set-Content -LiteralPath $hashPath -Value "$hash  app-debug.apk" -Encoding utf8NoBOM

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
        & $adbPath -s $devices[0] shell monkey -p app.readreflect.mobile -c android.intent.category.LAUNCHER 1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'The APK installed, but Android could not launch it.' }
        $installedDevice = $devices[0]
    }

    [ordered]@{
        ok = $true
        apk = $apkPath
        sha256 = $hash
        installedDevice = $installedDevice
        promptApiUrl = $PromptApiUrl
    } | ConvertTo-Json -Compress
} finally {
    Pop-Location
}
