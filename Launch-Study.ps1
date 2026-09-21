param([Parameter(Mandatory=$true)][string]$TopicDirectory)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
$topicRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'study-sessions')) + '\'
$resolvedTopic = [System.IO.Path]::GetFullPath($TopicDirectory)
if (-not $resolvedTopic.StartsWith($topicRoot,[System.StringComparison]::OrdinalIgnoreCase)) {throw 'Invalid topic directory.'}
$topicKey = Split-Path -Leaf $resolvedTopic
if ($topicKey -notmatch '^[a-f0-9]{32}$') {throw 'Invalid topic key.'}
$mutex = [System.Threading.Mutex]::new($false, ('Local\UpheavelStudy-' + $topicKey))
$ownsLock = $false
function Write-LaunchStatus($status,$message) {
  @{status=$status;message=$message;updatedAt=(Get-Date).ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $resolvedTopic 'launch-status.json') -Encoding UTF8
}
try {
 $ownsLock = $mutex.WaitOne(0)
 if (-not $ownsLock) {Write-Host 'This topic already has an open terminal.';return}
 @{pid=$PID} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $resolvedTopic 'active.json') -Encoding UTF8
 $config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'study-launcher.json') -Raw -Encoding UTF8 | ConvertFrom-Json
 if (-not (Test-Path -LiteralPath $config.codexPath)) {throw 'Codex CLI was moved or removed. Update study-launcher.json.'}
 $session = Get-Content -LiteralPath (Join-Path $resolvedTopic 'session.json') -Raw -Encoding UTF8 | ConvertFrom-Json
 $Host.UI.RawUI.WindowTitle = 'Upheavel - ' + $session.title
 Set-Location -LiteralPath $resolvedTopic
 $ErrorActionPreference = 'Continue'
 $login = (& $config.codexPath login status 2>&1 | Out-String)
 $loginExit = $LASTEXITCODE
 $ErrorActionPreference = 'Stop'
 if ($loginExit -ne 0 -or $login -notmatch 'Logged in using ChatGPT') {throw 'Sign into Codex CLI with ChatGPT first: codex login. This launcher does not use an API key.'}
 $cliArgs = @('--model','gpt-5.6-luna','--config','model_reasoning_effort="medium"','--search','--sandbox','workspace-write','--ask-for-approval','on-request','--cd',$resolvedTopic,'--config','forced_login_method="chatgpt"')
 if ($session.sessionId) {
   if ($session.sessionId -notmatch '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$') {throw 'Invalid saved session ID.'}
   $cliArgs = @('resume',$session.sessionId) + $cliArgs
   $prompt = 'Continue this Korean study session. Read the current TOPIC.json and PROGRESS.md first; preserve our previous progress and continue with the next useful exercise.'
 } else {
   $prompt = 'Start my Korean study session for the topic in TOPIC.json. Follow AGENTS.md, read PROGRESS.md, research reliable sources online, then give a concise everyday-use explanation and one diagnostic question. Save the study state as we go.'
 }
 Write-LaunchStatus 'running' 'Codex CLI is running.'
 & $config.codexPath @cliArgs $prompt
 if ($LASTEXITCODE -ne 0) {throw "Codex CLI exited with code $LASTEXITCODE."}
 Write-LaunchStatus 'closed' 'Study terminal closed. Click the topic to resume.'
} catch {
 Write-LaunchStatus 'error' $_.Exception.Message
 Write-Host $_.Exception.Message -ForegroundColor Red
 Read-Host 'Press Enter to close'
} finally {
 if ($ownsLock) {Remove-Item -LiteralPath (Join-Path $resolvedTopic 'active.json') -ErrorAction SilentlyContinue; $mutex.ReleaseMutex()}
 $mutex.Dispose()
}
