# 바탕화면 위젯: Edge 앱 창을 전용 프로필로 띄우고 제목 표시줄 숨김 + 맨 아래 고정 + 창 전체 반투명을 적용한다
# 사용법: 최초 1회 -Setup(구글 로그인) → -Install(시작프로그램 등록). 이후 로그인하면 자동으로 켜진다.
# 창 이동·크기 조절: 마우스를 창 맨 위(제목 표시줄이 있던 자리)에 올리면 틀이 나타난다. 커서가 창 밖으로 나가면 다시 숨는다.
param(
  [string]$Url = 'https://calender-web-ten.vercel.app/?widget=1',
  [int]$Opacity = 85, # 창 전체 불투명도(%). 낮출수록 바탕화면이 더 비친다(글자도 함께 흐려짐)
  [switch]$Setup,
  [switch]$Install
)

$ErrorActionPreference = 'Stop'
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$profileDir = Join-Path $env:LOCALAPPDATA 'CalendarWidget\edge-profile'

if ($Install) {
  $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path ([Environment]::GetFolderPath('Startup')) 'CalendarWidget.lnk'))
  $shortcut.TargetPath = 'powershell.exe'
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSCommandPath`" -Url `"$Url`" -Opacity $Opacity"
  $shortcut.WindowStyle = 7 # 최소화로 시작해 콘솔 창이 번쩍이지 않게 한다
  $shortcut.Save()
  Write-Host "Registered startup shortcut: $($shortcut.FullName)"
  return
}

# 구글 로그인은 Edge 전용 프로필에 1회만 하면 된다. 위젯 처리 없이 일반 창으로 연다.
if ($Setup) {
  $plainUrl = ($Url -split '\?')[0]
  Start-Process $edge "--app=$plainUrl --user-data-dir=`"$profileDir`" --no-first-run --no-default-browser-check --disable-sync"
  return
}

Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class Win32 {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern uint GetDpiForSystem();
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr h, int i, int v);
  [DllImport("user32.dll")] public static extern bool SetLayeredWindowAttributes(IntPtr h, uint key, byte alpha, uint flags);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vk);
  [DllImport("user32.dll")] public static extern int SetWindowRgn(IntPtr h, IntPtr rgn, bool redraw);
  [DllImport("gdi32.dll")] public static extern IntPtr CreateRectRgn(int l, int t, int r, int b);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int attr, out RECT r, int size);
  [DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr h, int attr, ref int v, int size);
  public struct RECT { public int L, T, R, B; }
  public struct POINT { public int X, Y; }
}
'@
# 물리 픽셀 좌표로 다루고, Edge 명령줄(--window-*)과 저장 파일은 DIP(논리 픽셀)로 변환해 쓴다
[void][Win32]::SetProcessDPIAware()
$systemScale = [Win32]::GetDpiForSystem() / 96

# 부팅 직후에는 네트워크가 아직 없을 수 있어 접속 가능해질 때까지 기다린다(최대 약 5분)
for ($i = 0; $i -lt 60; $i++) {
  try { [void][Net.Dns]::GetHostAddresses(([uri]$Url).Host); break } catch { Start-Sleep 5 }
}

# 위치·크기는 Edge의 자체 저장(종료 때만 기록되어 강제 종료·로그오프에 유실됨)에 맡기지 않고 아래 루프가 직접 파일에 저장해 다음 실행에서 복원한다.
# 파일이 없으면 웹 데스크탑 화면(사이드바 포함, 768px 이상)이 나오는 크기로 화면 오른쪽 위에 둔다.
$rectFile = Join-Path (Split-Path $profileDir) 'rect.txt'
$rect = $null
if (Test-Path $rectFile) { $rect = @((Get-Content $rectFile) -split ',' | ForEach-Object { [int]$_ }) }
if ($rect.Count -ne 4 -or $rect[2] -lt 400 -or $rect[3] -lt 300) {
  Add-Type -AssemblyName System.Windows.Forms
  $area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
  $width = 1100; $height = 720
  $rect = @([int]($area.Right / $systemScale - $width - 24), [int]($area.Top / $systemScale + 24), $width, $height)
}
# --disable-sync: 새 프로필이 윈도우 계정으로 Edge 동기화 로그인 안내 창을 띄우는 것을 막는다.
$edgeArgs = @("--app=$Url", "--user-data-dir=`"$profileDir`"", '--no-first-run', '--no-default-browser-check', '--disable-sync',
  "--window-position=$($rect[0]),$($rect[1])", "--window-size=$($rect[2]),$($rect[3])")

$process = Start-Process -FilePath $edge -ArgumentList $edgeArgs -PassThru
$hwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 100 -and $hwnd -eq [IntPtr]::Zero; $i++) {
  Start-Sleep -Milliseconds 300
  $process.Refresh()
  $hwnd = $process.MainWindowHandle
}
if ($hwnd -eq [IntPtr]::Zero) { throw 'Edge window not found.' }
# 첫 화면이 그려지기 전에 레이어드 스타일을 걸면 화면이 갱신되지 않고 흰 화면으로 남는다(실측). 그려질 시간을 준다.
Start-Sleep -Seconds 6

$GWL_EXSTYLE = -20; $WS_EX_LAYERED = 0x80000; $WS_EX_TOOLWINDOW = 0x80
$HWND_TOPMOST = [IntPtr](-1); $HWND_BOTTOM = [IntPtr]1; $SWP_NOSIZE_NOMOVE_NOACTIVATE = 0x0013
$LWA_ALPHA = 2
$alpha = [byte][Math]::Round(255 * [Math]::Min(100, [Math]::Max(20, $Opacity)) / 100)
$TITLE_DIP = 29 # Edge 앱 창 제목 표시줄 높이(실측), 테두리 1 DIP

function Get-FgClass {
  $sb = New-Object Text.StringBuilder 64
  [void][Win32]::GetClassName([Win32]::GetForegroundWindow(), $sb, 64)
  $sb.ToString()
}

# 창 틀(제목 표시줄·테두리·닫기 버튼)을 숨기거나 되살린다. 영역 잘라내기만으로는 윈도우가 그리는 배경 효과(Mica)·캡션 버튼·
# 위쪽 1px 선이 남으므로(실측) 함께 끈다: Mica 끔, 라운딩 끔, 캡션·리사이즈 테두리 스타일 제거(0xC40000), 본문 영역만 남기기.
$GWL_STYLE = -16
$originalStyle = [Win32]::GetWindowLong($hwnd, $GWL_STYLE)
function Set-Frame([bool]$hide) {
  $SWP_FRAMECHANGED_ONLY = 0x0037 # NOMOVE|NOSIZE|NOZORDER|NOACTIVATE|FRAMECHANGED
  if (-not $hide) {
    [void][Win32]::SetWindowRgn($hwnd, [IntPtr]::Zero, $true)
    [void][Win32]::SetWindowLong($hwnd, $GWL_STYLE, $originalStyle)
    [void][Win32]::SetWindowPos($hwnd, [IntPtr]::Zero, 0, 0, 0, 0, $SWP_FRAMECHANGED_ONLY)
    return
  }
  $off = 1 # DWMSBT_NONE / DWMWCP_DONOTROUND
  [void][Win32]::DwmSetWindowAttribute($hwnd, 38, [ref]$off, 4) # DWMWA_SYSTEMBACKDROP_TYPE
  [void][Win32]::DwmSetWindowAttribute($hwnd, 33, [ref]$off, 4) # DWMWA_WINDOW_CORNER_PREFERENCE
  [void][Win32]::SetWindowLong($hwnd, $GWL_STYLE, ($originalStyle -band (-bnot 0xC40000)))
  [void][Win32]::SetWindowPos($hwnd, [IntPtr]::Zero, 0, 0, 0, 0, $SWP_FRAMECHANGED_ONLY)
  $wr = New-Object Win32+RECT; $ef = New-Object Win32+RECT
  [void][Win32]::GetWindowRect($hwnd, [ref]$wr)
  [void][Win32]::DwmGetWindowAttribute($hwnd, 9, [ref]$ef, 16) # DWMWA_EXTENDED_FRAME_BOUNDS: 눈에 보이는 창 영역
  $scale = [Win32]::GetDpiForWindow($hwnd) / 96
  $region = [Win32]::CreateRectRgn(
    [int]($ef.L - $wr.L + $scale), [int]($ef.T - $wr.T + $TITLE_DIP * $scale),
    [int]($ef.R - $wr.L - $scale), [int]($ef.B - $wr.T - $scale))
  [void][Win32]::SetWindowRgn($hwnd, $region, $true)
}

$frameHidden = $true # 잘라내기는 아래 루프에서 레이어드 스타일을 건 뒤에 적용한다(먼저 지정하면 스타일 변경 때 풀린다, 실측)
$savedRect = $rect -join ','
$tick = 0

# 창이 닫힐 때까지 유지한다.
while ([Win32]::IsWindow($hwnd)) {
  $style = [Win32]::GetWindowLong($hwnd, $GWL_EXSTYLE)
  $wanted = $style -bor $WS_EX_LAYERED -bor $WS_EX_TOOLWINDOW
  if ($style -ne $wanted) {
    [void][Win32]::SetWindowLong($hwnd, $GWL_EXSTYLE, $wanted)
    [void][Win32]::SetLayeredWindowAttributes($hwnd, 0, $alpha, $LWA_ALPHA)
    Set-Frame $frameHidden
  }

  # 평소에는 맨 아래로 두고, Win+D·바탕화면 클릭으로 바탕화면이 활성화됐을 때만 맨 위로 올린다
  # (바탕화면 계층이 위젯을 덮기 때문). 다른 창이 활성화되면 곧바로 다시 맨 아래로 내려가며 TOPMOST도 풀린다.
  $fg = Get-FgClass
  $z = if ($fg -eq 'Progman' -or $fg -eq 'WorkerW') { $HWND_TOPMOST } else { $HWND_BOTTOM }
  [void][Win32]::SetWindowPos($hwnd, $z, 0, 0, 0, 0, $SWP_NOSIZE_NOMOVE_NOACTIVATE)

  # 마우스가 창 맨 위(제목 표시줄 자리)에 오면 틀을 보이고, 창 밖으로 나가면 숨긴다(드래그 중에는 유지)
  $wr = New-Object Win32+RECT; $pt = New-Object Win32+POINT
  if ([Win32]::GetWindowRect($hwnd, [ref]$wr) -and [Win32]::GetCursorPos([ref]$pt)) {
    $scale = [Win32]::GetDpiForWindow($hwnd) / 96
    $inside = $pt.X -ge $wr.L -and $pt.X -le $wr.R -and $pt.Y -ge $wr.T -and $pt.Y -le $wr.B
    $onTop = $inside -and $pt.Y -le ($wr.T + ($TITLE_DIP + 12) * $scale)
    $mouseDown = ([Win32]::GetAsyncKeyState(1) -band 0x8000) -ne 0
    if ($frameHidden -and $onTop) { Set-Frame $false; $frameHidden = $false }
    elseif (-not $frameHidden -and -not $inside -and -not $mouseDown) { Set-Frame $true; $frameHidden = $true }
  }

  # 약 2초마다 위치·크기가 바뀌었으면 DIP 단위로 저장한다(최소화 중이거나 비정상 값은 건너뜀)
  if (($tick++ % 7) -eq 0 -and -not [Win32]::IsIconic($hwnd) -and ($wr.R - $wr.L) -ge 400 -and ($wr.B - $wr.T) -ge 300 -and $wr.L -gt -10000) {
    $scale = [Win32]::GetDpiForWindow($hwnd) / 96
    $now = "$([int]($wr.L / $scale)),$([int]($wr.T / $scale)),$([int](($wr.R - $wr.L) / $scale)),$([int](($wr.B - $wr.T) / $scale))"
    if ($now -ne $savedRect) { Set-Content -Path $rectFile -Value $now; $savedRect = $now }
  }
  Start-Sleep -Milliseconds 300
}
