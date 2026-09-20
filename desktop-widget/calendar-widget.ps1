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

# 저장된 프로필이 없을 때(처음)만 위치·크기를 정한다. 이후에는 Edge가 기억한 위치·크기를 쓴다(직접 조정 가능).
# --disable-gpu/--disable-direct-composition: GPU 합성 상태에서는 Chromium이 색 키 투명을 무시한다(실측). 캘린더 정도는 소프트웨어 렌더링으로 충분하다.
# --disable-sync: 새 프로필이 윈도우 계정으로 Edge 동기화 로그인 안내 창을 띄우는 것을 막는다.
$edgeArgs = @("--app=$Url", "--user-data-dir=`"$profileDir`"", '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-gpu', '--disable-direct-composition')
if (-not (Test-Path (Join-Path $profileDir 'Default\Preferences'))) {
  Add-Type -AssemblyName System.Windows.Forms
  $area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
  $width = 480; $height = 760
  $edgeArgs += "--window-size=$width,$height", "--window-position=$($area.Right - $width - 24),$($area.Top + 24)"
}

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class Win32 {
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
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

$GWL_EXSTYLE = -20; $WS_EX_LAYERED = 0x80000; $WS_EX_TOOLWINDOW = 0x80
$HWND_BOTTOM = [IntPtr]1; $SWP_NOSIZE_NOMOVE_NOACTIVATE = 0x0013
$LWA_COLORKEY = 1

# 창이 닫힐 때까지 유지한다. 클릭해서 활성화돼도 곧바로 맨 아래로 다시 내려 다른 창을 가리지 않게 한다(방금 켜진 창도 포커스를 갖기 때문에 포커스 여부로 거르지 않는다).
while ([Win32]::IsWindow($hwnd)) {
  $style = [Win32]::GetWindowLong($hwnd, $GWL_EXSTYLE)
  $wanted = $style -bor $WS_EX_LAYERED -bor $WS_EX_TOOLWINDOW
  if ($style -ne $wanted) {
    [void][Win32]::SetWindowLong($hwnd, $GWL_EXSTYLE, $wanted)
    [void][Win32]::SetLayeredWindowAttributes($hwnd, $colorKey, 0, $LWA_COLORKEY)
  }
  [void][Win32]::SetWindowPos($hwnd, $HWND_BOTTOM, 0, 0, 0, 0, $SWP_NOSIZE_NOMOVE_NOACTIVATE)
  Start-Sleep -Milliseconds 300
}
