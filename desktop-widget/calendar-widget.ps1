# 바탕화면 위젯: Edge 앱 창을 전용 프로필로 띄우고 맨 아래 고정 + 배경 색 키 투명 + 작업표시줄 숨김을 적용한다
# 사용법: 최초 1회 -Setup(구글 로그인) → -Install(시작프로그램 등록). 이후 로그인하면 자동으로 켜진다.
param(
  [string]$Url = 'https://calender-web-ten.vercel.app/?widget=1',
  [switch]$Setup,
  [switch]$Install
)

$ErrorActionPreference = 'Stop'
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$profileDir = Join-Path $env:LOCALAPPDATA 'CalendarWidget\edge-profile'
$colorKey = 0x010101 # src/styles/tokens.css의 :root.widget --color-page(#010101)와 같아야 한다

if ($Install) {
  $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path ([Environment]::GetFolderPath('Startup')) 'CalendarWidget.lnk'))
  $shortcut.TargetPath = 'powershell.exe'
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSCommandPath`" -Url `"$Url`""
  $shortcut.WindowStyle = 7 # 최소화로 시작해 콘솔 창이 번쩍이지 않게 한다
  $shortcut.Save()
  Write-Host "시작프로그램에 등록했습니다: $($shortcut.FullName)"
  return
}

# 구글 로그인은 Edge 전용 프로필에 1회만 하면 된다. 투명·고정 없이 일반 창으로 연다.
if ($Setup) {
  $plainUrl = ($Url -split '\?')[0]
  Start-Process $edge "--app=$plainUrl --user-data-dir=`"$profileDir`" --no-first-run --no-default-browser-check"
  return
}

# 부팅 직후에는 네트워크가 아직 없을 수 있어 접속 가능해질 때까지 기다린다(최대 약 5분)
for ($i = 0; $i -lt 60; $i++) {
  try { [void][Net.Dns]::GetHostAddresses(([uri]$Url).Host); break } catch { Start-Sleep 5 }
}

# 위치·크기는 Edge의 자체 저장(종료 때만 기록되어 강제 종료·로그오프에 유실됨)에 맡기지 않고 아래 루프가 직접 파일에 저장해 다음 실행에서 복원한다. 파일이 없으면 화면 오른쪽에 480x760.
$rectFile = Join-Path (Split-Path $profileDir) 'rect.txt'
$rect = $null
if (Test-Path $rectFile) { $rect = @((Get-Content $rectFile) -split ',' | ForEach-Object { [int]$_ }) }
if ($rect.Count -ne 4 -or $rect[2] -lt 200 -or $rect[3] -lt 200) {
  Add-Type -AssemblyName System.Windows.Forms
  $area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
  $rect = @(($area.Right - 480 - 24), ($area.Top + 24), 480, 760)
}
# --disable-gpu/--disable-direct-composition: GPU 합성 상태에서는 Chromium이 색 키 투명을 무시한다(실측). 캘린더 정도는 소프트웨어 렌더링으로 충분하다.
# --disable-sync: 새 프로필이 윈도우 계정으로 Edge 동기화 로그인 안내 창을 띄우는 것을 막는다.
$edgeArgs = @("--app=$Url", "--user-data-dir=`"$profileDir`"", '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-gpu', '--disable-direct-composition',
  "--window-position=$($rect[0]),$($rect[1])", "--window-size=$($rect[2]),$($rect[3])")

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class Win32 {
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr h, int i, int v);
  [DllImport("user32.dll")] public static extern bool SetLayeredWindowAttributes(IntPtr h, uint key, byte alpha, uint flags);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
}
'@

$process = Start-Process -FilePath $edge -ArgumentList $edgeArgs -PassThru
$hwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 100 -and $hwnd -eq [IntPtr]::Zero; $i++) {
  Start-Sleep -Milliseconds 300
  $process.Refresh()
  $hwnd = $process.MainWindowHandle
}
if ($hwnd -eq [IntPtr]::Zero) { throw 'Edge 창을 찾지 못했습니다.' }
# 첫 화면이 그려지기 전에 레이어드 스타일을 걸면 화면이 갱신되지 않고 흰 화면으로 남는다(실측). 그려질 시간을 준다.
Start-Sleep -Seconds 6

$GWL_EXSTYLE = -20; $WS_EX_LAYERED = 0x80000; $WS_EX_TOOLWINDOW = 0x80
$HWND_BOTTOM = [IntPtr]1; $SWP_NOSIZE_NOMOVE_NOACTIVATE = 0x0013
$LWA_COLORKEY = 1

$savedRect = $rect -join ','
$tick = 0
# 창이 닫힐 때까지 유지한다. 클릭해서 활성화돼도 곧바로 맨 아래로 다시 내려 다른 창을 가리지 않게 한다(방금 켜진 창도 포커스를 갖기 때문에 포커스 여부로 거르지 않는다).
while ([Win32]::IsWindow($hwnd)) {
  $style = [Win32]::GetWindowLong($hwnd, $GWL_EXSTYLE)
  $wanted = $style -bor $WS_EX_LAYERED -bor $WS_EX_TOOLWINDOW
  if ($style -ne $wanted) {
    [void][Win32]::SetWindowLong($hwnd, $GWL_EXSTYLE, $wanted)
    [void][Win32]::SetLayeredWindowAttributes($hwnd, $colorKey, 0, $LWA_COLORKEY)
  }
  [void][Win32]::SetWindowPos($hwnd, $HWND_BOTTOM, 0, 0, 0, 0, $SWP_NOSIZE_NOMOVE_NOACTIVATE)
  # 약 2초마다 위치·크기가 바뀌었으면 저장한다(최소화 중이거나 비정상 값은 건너뜀)
  if (($tick++ % 7) -eq 0 -and -not [Win32]::IsIconic($hwnd)) {
    $r = New-Object Win32+RECT
    if ([Win32]::GetWindowRect($hwnd, [ref]$r) -and ($r.R - $r.L) -ge 200 -and ($r.B - $r.T) -ge 200 -and $r.L -gt -10000) {
      $now = "$($r.L),$($r.T),$($r.R - $r.L),$($r.B - $r.T)"
      if ($now -ne $savedRect) { Set-Content -Path $rectFile -Value $now; $savedRect = $now }
    }
  }
  Start-Sleep -Milliseconds 300
}
