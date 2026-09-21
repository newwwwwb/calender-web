# 바탕화면 위젯: Edge 앱 창을 전용 프로필로 띄우고 제목 표시줄 숨김 + 맨 아래 고정 + 배경만 투명(색 키)을 적용한다
# 사용법: 최초 1회 -Setup(구글 로그인) → -Install(시작프로그램 등록). 이후 로그인하면 자동으로 켜진다.
# 창 이동·크기 조절: 마우스를 창 맨 위(제목 표시줄이 있던 자리)에 올리면 틀이 나타난다. 커서가 창 밖으로 나가면 다시 숨는다.
# 창을 닫거나 Edge가 종료돼도 10초 뒤 다시 뜬다. 완전히 끄려면 작업 관리자에서 powershell(calendar-widget.ps1)과 msedge(위젯 프로필)를 종료한다.
# 전제: 모니터 배율이 모두 같다(혼합 배율 멀티 모니터는 좌표 변환이 어긋날 수 있다).
param(
  [string]$Url = 'https://calender-web-ten.vercel.app/?widget=1',
  [int]$Opacity = 100, # 창 전체 불투명도(%). 100이면 배경(색 키)만 투명하고 나머지는 또렷하다. 낮추면 글자·칩까지 함께 흐려진다
  [switch]$Setup,
  [switch]$Install
)

$ErrorActionPreference = 'Stop'
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'Edge not found.' }
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

# 이중 실행 방지: 시작프로그램과 수동 실행이 겹치면 두 번째는 조용히 끝낸다
$mutex = New-Object Threading.Mutex($false, 'CalendarWidgetSingleInstance')
try { $ownsMutex = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $ownsMutex = $true } # 이전 스크립트가 강제 종료되면 뮤텍스가 "버려진 상태"로 남는다
if (-not $ownsMutex) { return }

Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class Win32 {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr h);
  [DllImport("dwmapi.dll", EntryPoint="DwmGetWindowAttribute")] static extern int DwmGetWindowAttributeInt(IntPtr h, int attr, out int v, int size);
  // 위젯 프로세스를 뺀 "다른 프로그램의 보이는 창" 수. 최소화·숨김(cloaked)·툴윈도우·제목 없는 보조 창·UWP 헬퍼·바탕화면/작업표시줄은 세지 않는다.
  public static int CountAppWindows(uint excludePid) {
    int n = 0;
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h) || IsIconic(h) || GetWindowTextLength(h) == 0) return true;
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (pid == excludePid) return true;
      int ex = GetWindowLong(h, -20);
      if ((ex & 0x80) != 0 || (ex & 0x8000000) != 0) return true; // TOOLWINDOW, NOACTIVATE
      int cloaked; DwmGetWindowAttributeInt(h, 13, out cloaked, 4);
      if (cloaked != 0) return true;
      RECT r; GetWindowRect(h, out r);
      if (r.R - r.L < 100 || r.B - r.T < 100) return true;
      StringBuilder sb = new StringBuilder(64); GetClassName(h, sb, 64);
      string c = sb.ToString();
      if (c == "Progman" || c == "WorkerW" || c.StartsWith("Shell_") || c == "Windows.UI.Core.CoreWindow") return true; // CoreWindow는 UWP 프레임 안쪽/시스템 헬퍼 창
      n++;
      return true;
    }, IntPtr.Zero);
    return n;
  }
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern uint GetDpiForSystem();
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr h, int i, int v);
  [DllImport("user32.dll")] public static extern bool SetLayeredWindowAttributes(IntPtr h, uint key, byte alpha, uint flags);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vk);
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int i);
  [DllImport("user32.dll")] public static extern int SetWindowRgn(IntPtr h, IntPtr rgn, bool redraw);
  [DllImport("user32.dll")] public static extern int GetWindowRgnBox(IntPtr h, out RECT r);
  [DllImport("gdi32.dll")] public static extern IntPtr CreateRectRgn(int l, int t, int r, int b);
  [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr o);
  [DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr h, int attr, ref int v, int size);
  public struct RECT { public int L, T, R, B; }
  public struct POINT { public int X, Y; }
}
'@
Add-Type -AssemblyName System.Windows.Forms
# 물리 픽셀 좌표로 다루고, Edge 명령줄(--window-*)과 저장 파일은 DIP(논리 픽셀)로 변환해 쓴다
[void][Win32]::SetProcessDPIAware()
$systemScale = [Win32]::GetDpiForSystem() / 96

$rectFile = Join-Path (Split-Path $profileDir) 'rect.txt'
$GWL_STYLE = -16; $GWL_EXSTYLE = -20; $WS_EX_LAYERED = 0x80000; $WS_EX_TOOLWINDOW = 0x80
$CAPTION_FRAME_STYLE = 0xC40000 # WS_CAPTION | WS_THICKFRAME
$HWND_TOPMOST = [IntPtr](-1); $HWND_BOTTOM = [IntPtr]1
$SWP_NOSIZE_NOMOVE_NOACTIVATE = 0x0013; $SWP_FRAMECHANGED_ONLY = 0x0037 # 0x0037 = NOMOVE|NOSIZE|NOZORDER|NOACTIVATE|FRAMECHANGED
$LWA_COLORKEY = 1; $LWA_ALPHA = 2
$COLOR_KEY = 0xFEFFFF # RGB(255,255,254)의 COLORREF(BGR). src/styles/tokens.css의 :root.widget --color-page(#fffffe)와 같아야 한다
$alpha = [byte][Math]::Round(255 * [Math]::Min(100, [Math]::Max(20, $Opacity)) / 100)
$TITLE_DIP = 29 # Edge 앱 창 제목 표시줄 높이(실측), 테두리 1 DIP
$MIN_W = 400; $MIN_H = 300 # DIP

# 화면의 작업 영역(DIP) 목록
function Get-WorkAreas {
  foreach ($s in [System.Windows.Forms.Screen]::AllScreens) {
    $w = $s.WorkingArea
    [pscustomobject]@{ L = $w.Left / $systemScale; T = $w.Top / $systemScale; R = $w.Right / $systemScale; B = $w.Bottom / $systemScale }
  }
}

# 저장된 위치가 지금 어떤 화면과 충분히(100x100 DIP 이상) 겹치는지. 모니터를 뗀 뒤 창이 화면 밖에 남으면 틀이 숨겨져 있어 못 찾는다.
function Test-RectVisible($r) {
  foreach ($a in Get-WorkAreas) {
    $w = [Math]::Min($r[0] + $r[2], $a.R) - [Math]::Max($r[0], $a.L)
    $h = [Math]::Min($r[1] + $r[3], $a.B) - [Math]::Max($r[1], $a.T)
    if ($w -ge 100 -and $h -ge 100) { return $true }
  }
  return $false
}

# 저장된 위치·크기(DIP). 없거나 손상됐거나 화면 밖이면 기본값(웹 데스크탑 화면이 나오는 크기, 작업 영역보다 크지 않게 화면 오른쪽 위).
function Get-WidgetRect {
  try {
    if (Test-Path $rectFile) {
      $r = @((Get-Content $rectFile) -split ',' | ForEach-Object { [int]$_ })
      if ($r.Count -eq 4 -and $r[2] -ge $MIN_W -and $r[3] -ge $MIN_H -and (Test-RectVisible $r)) { return $r }
    }
  } catch { }
  $p = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
  $w = [int][Math]::Min(1100, $p.Width / $systemScale - 48); $h = [int][Math]::Min(720, $p.Height / $systemScale - 48)
  return @([int]($p.Right / $systemScale - $w - 24), [int]($p.Top / $systemScale + 24), $w, $h)
}

# 창이 닫힐 때까지 위젯 창을 관리한다. 예외가 나면 호출한 쪽이 잠시 뒤 다시 시작한다.
function Start-WidgetSession {
  # 전용 프로필이라 남아 있는 Edge(이전 세션·-Setup 창)는 정리한다. 이미 떠 있으면 새 창이 그 프로세스에 붙어 창 핸들을 못 얻는다.
  Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" |
    Where-Object { $_.CommandLine -like '*CalendarWidget*edge-profile*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

  # 부팅 직후에는 네트워크가 아직 없을 수 있어 실제로 응답이 올 때까지 기다린다(최대 약 5분)
  for ($i = 0; $i -lt 60; $i++) {
    try { [void](Invoke-WebRequest -Uri $Url -Method Head -UseBasicParsing -TimeoutSec 5); break } catch { Start-Sleep 5 }
  }

  $rect = Get-WidgetRect
  # --disable-gpu/--disable-direct-composition: GPU 합성 상태에서는 Chromium이 색 키 투명을 무시한다(실측). 캘린더 정도는 소프트웨어 렌더링으로 충분하다.
  # --disable-sync: 새 프로필이 윈도우 계정으로 Edge 동기화 로그인 안내 창을 띄우는 것을 막는다.
  $edgeArgs = @("--app=$Url", "--user-data-dir=`"$profileDir`"", '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-gpu', '--disable-direct-composition',
    "--window-position=$($rect[0]),$($rect[1])", "--window-size=$($rect[2]),$($rect[3])")
  $process = Start-Process -FilePath $edge -ArgumentList $edgeArgs -PassThru
  $hwnd = [IntPtr]::Zero
  for ($i = 0; $i -lt 200 -and $hwnd -eq [IntPtr]::Zero; $i++) {
    Start-Sleep -Milliseconds 300
    $process.Refresh()
    $hwnd = $process.MainWindowHandle
  }
  if ($hwnd -eq [IntPtr]::Zero) { throw 'Edge window not found.' }
  # 첫 화면이 그려지기 전에 레이어드 스타일을 걸면 화면이 갱신되지 않고 흰 화면으로 남는다(실측). 그려질 시간을 준다.
  Start-Sleep -Seconds 8

  $widgetPid = 0
  [void][Win32]::GetWindowThreadProcessId($hwnd, [ref]$widgetPid)
  $leftButton = if ([Win32]::GetSystemMetrics(23) -ne 0) { 2 } else { 1 } # SM_SWAPBUTTON: 왼손잡이 설정이면 물리 오른쪽 버튼이 주 버튼

  # 창 틀(제목 표시줄·테두리·닫기 버튼)을 숨기거나 되살린다. 영역 잘라내기만으로는 윈도우가 그리는 배경 효과(Mica)·캡션 버튼·
  # 위쪽 1px 선이 남으므로(실측) 함께 끈다: Mica 끔, 라운딩 끔, 캡션·리사이즈 테두리 스타일 제거, 본문 영역만 남기기.
  # 되살릴 때는 Mica·라운딩(DWM 속성)은 그대로 두고 스타일과 영역만 되돌린다. 스타일은 저장해 둔 원본이 아니라 그때그때 현재 값에서
  # 비트만 바꾼다(창이 최대화되는 등 Edge가 스타일을 바꿨을 때 옛 값으로 덮어쓰지 않도록).
  function Set-Frame([bool]$hide) {
    $style = [Win32]::GetWindowLong($hwnd, $GWL_STYLE)
    if (-not $hide) {
      [void][Win32]::SetWindowRgn($hwnd, [IntPtr]::Zero, $true)
      [void][Win32]::SetWindowLong($hwnd, $GWL_STYLE, ($style -bor $CAPTION_FRAME_STYLE))
      [void][Win32]::SetWindowPos($hwnd, [IntPtr]::Zero, 0, 0, 0, 0, $SWP_FRAMECHANGED_ONLY)
      return
    }
    $off = 1 # DWMSBT_NONE / DWMWCP_DONOTROUND
    [void][Win32]::DwmSetWindowAttribute($hwnd, 38, [ref]$off, 4) # DWMWA_SYSTEMBACKDROP_TYPE
    [void][Win32]::DwmSetWindowAttribute($hwnd, 33, [ref]$off, 4) # DWMWA_WINDOW_CORNER_PREFERENCE
    [void][Win32]::SetWindowLong($hwnd, $GWL_STYLE, ($style -band (-bnot $CAPTION_FRAME_STYLE)))
    [void][Win32]::SetWindowPos($hwnd, [IntPtr]::Zero, 0, 0, 0, 0, $SWP_FRAMECHANGED_ONLY)
    # 영역은 창 사각형이 아니라 실제로 그림이 그려지는 클라이언트 영역(좌·우·아래로 창보다 약 12px 안쪽, 실측) 기준으로 잡는다.
    # 그 바깥 띠는 소프트웨어 렌더링(GPU 끔)에서 검게 칠해져 보이기 때문이다(실측). 위쪽은 제목 표시줄 높이만큼 더 자른다.
    $wr = New-Object Win32+RECT; $cr = New-Object Win32+RECT; $pt = New-Object Win32+POINT
    [void][Win32]::GetWindowRect($hwnd, [ref]$wr)
    [void][Win32]::GetClientRect($hwnd, [ref]$cr)
    [void][Win32]::ClientToScreen($hwnd, [ref]$pt)
    $scale = [Win32]::GetDpiForWindow($hwnd) / 96
    $left = $pt.X - $wr.L
    $top = $pt.Y - $wr.T + [int]($TITLE_DIP * $scale)
    $region = [Win32]::CreateRectRgn($left, $top, $left + $cr.R, $pt.Y - $wr.T + $cr.B)
    if ([Win32]::SetWindowRgn($hwnd, $region, $true) -eq 0) { [void][Win32]::DeleteObject($region) } # 성공하면 시스템이 소유한다
  }

  $frameHidden = $true # 잘라내기는 아래 루프에서 레이어드 스타일을 건 뒤에 적용한다(먼저 지정하면 스타일 변경 때 풀린다, 실측)
  $savedRect = $rect -join ','
  $tick = 0
  $raised = $false
  $windowsAtRaise = 0

  # 창이 닫힐 때까지 유지한다. 한 번의 예외로 관리가 멈추지 않도록 반복마다 잡는다.
  while ([Win32]::IsWindow($hwnd)) {
    try {
      $scale = [Win32]::GetDpiForWindow($hwnd) / 96
      $exStyle = [Win32]::GetWindowLong($hwnd, $GWL_EXSTYLE)
      $wantedEx = $exStyle -bor $WS_EX_LAYERED -bor $WS_EX_TOOLWINDOW
      if ($exStyle -ne $wantedEx) {
        [void][Win32]::SetWindowLong($hwnd, $GWL_EXSTYLE, $wantedEx)
        [void][Win32]::SetLayeredWindowAttributes($hwnd, $COLOR_KEY, $alpha, $LWA_COLORKEY -bor $LWA_ALPHA)
        Set-Frame $frameHidden
      }

      # 평소에는 맨 아래로 두고, 바탕화면 보기 상태(Win+D·바탕화면 클릭으로 활성 창이 바탕화면이 됨)에서만 맨 위로 올린다.
      # 그 상태에서는 바탕화면 계층이 맨 아래 위젯을 덮기 때문이다(실측). 올라온 동안에는:
      #  - 위젯을 클릭하거나 위젯의 메뉴·팝업이 활성이 돼도 유지한다(안 그러면 그 순간 바탕화면 밑으로 가라앉아 사라진다, 실측).
      #  - 다른 프로그램의 창이 활성화되면 내린다.
      #  - 창이 복구돼(보이는 창 수가 올라올 때보다 늘어남) 있으면 위젯이 활성으로 남아 있어도 내린다(안 그러면 복구된 창을 계속 가린다, 실측).
      # "보이는 창이 0개"가 아니라 "늘었는가"로 보는 이유: Win+D가 최소화하지 못하는 창(설정 앱 등 UWP·시스템 창)이 이 PC에 실제로 있다(실측).
      $sb = New-Object Text.StringBuilder 64
      $fgWindow = [Win32]::GetForegroundWindow()
      [void][Win32]::GetClassName($fgWindow, $sb, 64)
      $fgClass = $sb.ToString()
      $fgPid = 0
      [void][Win32]::GetWindowThreadProcessId($fgWindow, [ref]$fgPid)
      # 기준 개수는 올라온 뒤 관측한 최솟값이다(Win+D 직후에는 창들이 아직 최소화되는 중이라 처음 값이 실제보다 크다).
      if ($fgClass -eq 'Progman' -or $fgClass -eq 'WorkerW') {
        $windows = [Win32]::CountAppWindows($widgetPid)
        $windowsAtRaise = if ($raised) { [Math]::Min($windowsAtRaise, $windows) } else { $windows }
        $raised = $true
      } elseif ($fgPid -ne $widgetPid) {
        $raised = $false
      } elseif ($raised) {
        $windows = [Win32]::CountAppWindows($widgetPid)
        if ($windows -gt $windowsAtRaise) { $raised = $false } else { $windowsAtRaise = $windows }
      }
      $z = if ($raised) { $HWND_TOPMOST } else { $HWND_BOTTOM }
      [void][Win32]::SetWindowPos($hwnd, $z, 0, 0, 0, 0, $SWP_NOSIZE_NOMOVE_NOACTIVATE)

      # 마우스가 창 맨 위(제목 표시줄 자리)에 오면 틀을 보이고, 창 밖으로 나가면 숨긴다(드래그 중에는 유지)
      $wr = New-Object Win32+RECT; $pt = New-Object Win32+POINT
      if ([Win32]::GetWindowRect($hwnd, [ref]$wr) -and [Win32]::GetCursorPos([ref]$pt)) {
        $inside = $pt.X -ge $wr.L -and $pt.X -le $wr.R -and $pt.Y -ge $wr.T -and $pt.Y -le $wr.B
        $onTop = $inside -and $pt.Y -le ($wr.T + ($TITLE_DIP + 12) * $scale)
        $mouseDown = ([Win32]::GetAsyncKeyState($leftButton) -band 0x8000) -ne 0
        if ($frameHidden -and $onTop) { Set-Frame $false; $frameHidden = $false }
        elseif (-not $frameHidden -and -not $inside -and -not $mouseDown) { Set-Frame $true; $frameHidden = $true }
      }

      # 약 2초마다: (1) 틀을 숨긴 상태인데 Chromium이 스타일·영역을 되돌렸으면(해상도·배율 변경, 최대화·복원) 다시 건다.
      # (2) 위치·크기가 바뀌었으면 DIP 단위로 저장한다(최소화·최대화 중이거나 비정상 값은 건너뜀).
      if (($tick++ % 7) -eq 0) {
        if ($frameHidden) {
          $box = New-Object Win32+RECT
          $hasRegion = [Win32]::GetWindowRgnBox($hwnd, [ref]$box) -ne 0
          $hasFrameStyle = ([Win32]::GetWindowLong($hwnd, $GWL_STYLE) -band $CAPTION_FRAME_STYLE) -ne 0
          if ($hasFrameStyle -or -not $hasRegion) { Set-Frame $true }
        }
        if (-not [Win32]::IsIconic($hwnd) -and -not [Win32]::IsZoomed($hwnd) -and ($wr.R - $wr.L) -ge $MIN_W * $scale -and ($wr.B - $wr.T) -ge $MIN_H * $scale -and $wr.L -gt -10000) {
          $now = "$([int]($wr.L / $scale)),$([int]($wr.T / $scale)),$([int](($wr.R - $wr.L) / $scale)),$([int](($wr.B - $wr.T) / $scale))"
          if ($now -ne $savedRect) {
            try { Set-Content -Path $rectFile -Value $now; $savedRect = $now } catch { } # 파일이 잠겼으면 다음 주기에 다시 시도
          }
        }
      }
    } catch { }
    Start-Sleep -Milliseconds 300
  }
}

# 창을 닫거나 Edge가 종료돼도, 시작 중 예외가 나도 10초 뒤 다시 띄운다
while ($true) {
  try { Start-WidgetSession } catch { }
  Start-Sleep -Seconds 10
}
