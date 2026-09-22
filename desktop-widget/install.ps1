# 바탕화면 위젯 한 줄 설치: 스크립트를 내려받아 시작프로그램에 등록하고, 구글 로그인 창이 닫히면 위젯을 띄운다
# 사용법: irm https://raw.githubusercontent.com/newwwwwb/calender-web/master/desktop-widget/install.ps1 | iex
# 다시 실행하면 최신 스크립트로 업데이트된다.
$ErrorActionPreference = 'Stop'
$dir = Join-Path $env:LOCALAPPDATA 'CalendarWidget'
$ps1 = Join-Path $dir 'calendar-widget.ps1'
$widgetEdge = { Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*CalendarWidget*edge-profile*' } }

# 실행 중인 위젯은 끈다. 켜져 있으면 로그인 창이 위젯 Edge에 붙어 닫힘을 감지할 수 없고, 새 스크립트도 이중 실행 방지로 뜨지 않는다.
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like '*calendar-widget.ps1*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
& $widgetEdge | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

# -Install은 자기 파일 경로를 바로가기에 넣으므로 로컬 파일로 받아서 실행해야 한다
New-Item -ItemType Directory -Force $dir | Out-Null
# BOM 없이 저장하면 Windows PowerShell 5.1이 ANSI(CP949)로 읽어 한국어 주석이 LF 줄바꿈을 삼키고 파싱 오류가 난다(실측). BOM을 붙여 저장한다.
$script = Invoke-RestMethod 'https://raw.githubusercontent.com/newwwwwb/calender-web/master/desktop-widget/calendar-widget.ps1'
[IO.File]::WriteAllText($ps1, $script, (New-Object Text.UTF8Encoding $true))
powershell -NoProfile -ExecutionPolicy Bypass -File $ps1 -Install
if ($LASTEXITCODE -ne 0) { throw '위젯 등록에 실패했습니다.' }
powershell -NoProfile -ExecutionPolicy Bypass -File $ps1 -Setup

Write-Host '지금 열린 창은 위젯이 아니라 로그인용 창입니다.' -ForegroundColor Yellow
Write-Host '구글 로그인을 마친 뒤(이미 로그인돼 있으면 바로) 이 창을 닫아야 위젯이 뜹니다. 창을 닫을 때까지 설치가 끝나지 않습니다.'
Start-Sleep -Seconds 5
while (& $widgetEdge) { Start-Sleep -Seconds 2 }
Start-Process (Join-Path ([Environment]::GetFolderPath('Startup')) 'CalendarWidget.lnk')
Write-Host '위젯을 실행했습니다. 다음부터는 로그인하면 자동으로 켜집니다.'
