param(
  [ValidateSet('debug', 'bundle')]
  [string]$Kind = 'debug',
  [int]$VersionCode = 1,
  [string]$VersionName = '1.0.0'
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$javaCandidates = @(@(
  $env:JAVA_HOME,
  'C:\Program Files\Android\Android Studio\jbr',
  'C:\Program Files\Android\Android Studio\jre'
) | Where-Object { $_ -and (Test-Path (Join-Path $_ 'bin\java.exe')) })

if (-not $javaCandidates.Count) {
  throw 'Java was not found. Install Android Studio or set JAVA_HOME before building.'
}
$env:JAVA_HOME = $javaCandidates[0]

if ($Kind -eq 'bundle') {
  $env:BASELINE_BUILD = 'production'
  if (-not $env:BASELINE_APP_URL) {
    throw 'Set BASELINE_APP_URL to the public HTTPS production address before building a store bundle.'
  }
}

Push-Location $root
try {
  & npx.cmd cap sync android
  if ($LASTEXITCODE -ne 0) { throw 'Capacitor Android sync failed.' }
  Push-Location (Join-Path $root 'android')
  try {
    $task = if ($Kind -eq 'bundle') { 'bundleRelease' } else { 'assembleDebug' }
    & .\gradlew.bat $task "-PBASELINE_VERSION_CODE=$VersionCode" "-PBASELINE_VERSION_NAME=$VersionName"
    if ($LASTEXITCODE -ne 0) { throw "Android $Kind build failed." }
  } finally {
    Pop-Location
  }
} finally {
  Pop-Location
}
