param(
  [string]$Version = ((Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\VERSION') -Raw).Trim())
)

$ErrorActionPreference = 'Stop'
$root = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath((Join-Path $PSScriptRoot '..'))
$previousLocation = (Get-Location).Path
$archive = Join-Path ([System.IO.Path]::GetTempPath()) "baseline-src-$Version-$([guid]::NewGuid().ToString('N')).tar.gz"

try {
  if ($root.StartsWith('\\')) {
    Set-Location "$($env:SystemDrive)\"
    cmd.exe /d /c "pushd $root && npm.cmd test"
  } else {
    Set-Location $root
    npm.cmd test
  }
  if ($LASTEXITCODE -ne 0) { throw 'Tests failed; release cancelled.' }

  tar.exe -czf $archive --exclude=.git --exclude=node_modules --exclude=.vinext --exclude=output --exclude=.playwright-cli -C $root .
  if ($LASTEXITCODE -ne 0) { throw 'Release source archive could not be created.' }

  node (Join-Path $PSScriptRoot 'truenas-registry-release.mjs') $Version $archive
  if ($LASTEXITCODE -ne 0) { throw 'TrueNAS deployment failed.' }
} finally {
  if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
  if (Test-Path -LiteralPath $previousLocation) {
    Set-Location $previousLocation
  } else {
    Set-Location "$($env:SystemDrive)\"
  }
}
