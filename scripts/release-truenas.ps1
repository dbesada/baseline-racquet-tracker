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
    # Install any packages added since the last release, then test.
    cmd.exe /d /c "pushd $root && npm.cmd install --no-audit --no-fund && npm.cmd test"
  } else {
    Set-Location $root
    npm.cmd install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Packages could not be installed; release cancelled.' }
    npm.cmd test
  }
  if ($LASTEXITCODE -ne 0) { throw 'Tests failed; release cancelled.' }

  tar.exe -czf $archive --exclude=.git --exclude=.env --exclude=.env.* --exclude=node_modules --exclude=.vinext --exclude=output --exclude=.playwright-cli -C $root .
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
