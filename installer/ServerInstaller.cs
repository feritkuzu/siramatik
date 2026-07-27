using System;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Diagnostics;
using System.Reflection;
using System.Windows.Forms;
using System.Drawing;
using System.Threading.Tasks;

class ServerInstallerForm : Form {
  private TextBox pathBox;
  private Button browseBtn, installBtn, cancelBtn;
  private ProgressBar progressBar;
  private Label statusLabel, titleLabel, subtitleLabel;
  private RichTextBox logBox;
  private bool nodeMissing, internetOk;
  private bool installing;
  private string extractDir;
  private byte[] exeData;
  private int zipSize, zipStart;

  public ServerInstallerForm() {
    Text = "Siramatik Server Kurulumu";
    Size = new Size(560, 480);
    StartPosition = FormStartPosition.CenterScreen;
    FormBorderStyle = FormBorderStyle.FixedDialog;
    MaximizeBox = false;
    BackColor = Color.FromArgb(18, 18, 18);
    Font = new Font("Segoe UI", 10);

    titleLabel = new Label {
      Text = "SiRAMATiK SUNUCU KURULUMU", ForeColor = Color.FromArgb(0, 255, 255),
      Font = new Font("Segoe UI", 18, FontStyle.Bold), Location = new Point(20, 16),
      Size = new Size(520, 36), TextAlign = ContentAlignment.MiddleCenter
    };
    subtitleLabel = new Label {
      Text = "Sıra yönetim sistemi sunucu kurulumu",
      ForeColor = Color.Gray, Location = new Point(20, 52),
      Size = new Size(520, 20), TextAlign = ContentAlignment.MiddleCenter
    };

    var pathLabel = new Label { Text = "Kurulum Klasörü:", ForeColor = Color.White,
      Location = new Point(20, 88), Size = new Size(120, 24) };
    pathBox = new TextBox { Text = @"C:\Siramatik\Server",
      Location = new Point(140, 86), Size = new Size(280, 24),
      BackColor = Color.FromArgb(30, 30, 30), ForeColor = Color.White, BorderStyle = BorderStyle.FixedSingle };
    browseBtn = new Button { Text = "...", Location = new Point(426, 85), Size = new Size(30, 26),
      BackColor = Color.FromArgb(60, 60, 60), ForeColor = Color.White, FlatStyle = FlatStyle.Flat };
    browseBtn.Click += (s, e) => {
      using (var dlg = new FolderBrowserDialog()) {
        dlg.SelectedPath = pathBox.Text;
        if (dlg.ShowDialog() == DialogResult.OK) pathBox.Text = dlg.SelectedPath;
      }
    };

    progressBar = new ProgressBar { Location = new Point(20, 124), Size = new Size(502, 20),
      Style = ProgressBarStyle.Continuous, ForeColor = Color.FromArgb(0, 255, 255), BackColor = Color.FromArgb(30,30,30) };

    statusLabel = new Label { Text = "Hazır", ForeColor = Color.Gray,
      Location = new Point(20, 150), Size = new Size(502, 20) };

    logBox = new RichTextBox {
      Location = new Point(20, 176), Size = new Size(502, 200),
      BackColor = Color.FromArgb(24, 24, 24), ForeColor = Color.FromArgb(200, 200, 200),
      ReadOnly = true, BorderStyle = BorderStyle.FixedSingle, Font = new Font("Consolas", 9)
    };

    installBtn = new Button { Text = "KUR", Location = new Point(340, 394), Size = new Size(100, 36),
      BackColor = Color.FromArgb(0, 200, 0), ForeColor = Color.White, FlatStyle = FlatStyle.Flat,
      Font = new Font("Segoe UI", 12, FontStyle.Bold) };
    installBtn.Click += InstallClick;

    cancelBtn = new Button { Text = "İPTAL", Location = new Point(446, 394), Size = new Size(76, 36),
      BackColor = Color.FromArgb(80, 80, 80), ForeColor = Color.White, FlatStyle = FlatStyle.Flat };
    cancelBtn.Click += (s, e) => Close();

    Controls.AddRange(new Control[] { titleLabel, subtitleLabel, pathLabel, pathBox,
      browseBtn, progressBar, statusLabel, logBox, installBtn, cancelBtn });

    Load += async (s, e) => await CheckPrerequisites();
  }

  async Task CheckPrerequisites() {
    Log("Ön koşullar kontrol ediliyor...");

    // Admin check
    try {
      using (var p = Process.Start(new ProcessStartInfo("net", "session") {
        CreateNoWindow = true, RedirectStandardOutput = true, UseShellExecute = false
      })) {
        if (p != null) { p.WaitForExit(3000); if (p.ExitCode != 0) { Fail("Yönetici olarak çalıştırın!"); return; } }
      }
    } catch { Fail("Yönetici yetkisi gerekli!"); return; }
    Log("[OK] Yönetici yetkisi mevcut");

    // Node.js check
    string nodePath = FindNode();
    nodeMissing = (nodePath == null);
    if (!nodeMissing) {
      Log("[OK] Node.js mevcut: " + nodePath);
    } else {
      Log("[!] Node.js bulunamadı, kurulum sırasında indirilecek");
    }

    // Internet check
    internetOk = await CheckInternet();
    Log(internetOk ? "[OK] İnternet bağlantısı var" : "[!] İnternet yok");
    if (nodeMissing && !internetOk) { Fail("Node.js gerekli ama internet bağlantısı yok!"); return; }

    // Port check
    try {
      using (var p = Process.Start(new ProcessStartInfo("netstat", "-ano | findstr \":3000 \"") {
        CreateNoWindow = true, RedirectStandardOutput = true, UseShellExecute = false
      })) {
        if (p != null) {
          string output = p.StandardOutput.ReadToEnd();
          p.WaitForExit(2000);
          if (!string.IsNullOrEmpty(output.Trim())) {
            Fail("3000 portu kullanımda! Mevcut uygulamayı durdurun.");
            return;
          }
        }
      }
    } catch { }
    Log("[OK] 3000 portu müsait");

    installBtn.Enabled = true;
  }

  string FindNode() {
    string pathEnv = Environment.GetEnvironmentVariable("PATH");
    if (pathEnv != null) {
      string[] dirs = pathEnv.Split(';');
      foreach (string d in dirs) {
        try {
          string trimmed = d.Trim('"');
          if (File.Exists(Path.Combine(trimmed, "node.exe"))) return Path.Combine(trimmed, "node.exe");
        } catch { }
      }
    }
    string[] checks = { @"C:\Program Files\nodejs\node.exe", @"C:\Program Files (x86)\nodejs\node.exe" };
    foreach (string c in checks) if (File.Exists(c)) return c;
    return null;
  }

  async Task<bool> CheckInternet() {
    try { using (var wc = new WebClient()) { await wc.DownloadDataTaskAsync("http://google.com"); return true; } }
    catch { return false; }
  }

  async void InstallClick(object sender, EventArgs e) {
    if (installing) return;
    installing = true;
    installBtn.Enabled = false;
    browseBtn.Enabled = false;
    pathBox.Enabled = false;
    string installDir = pathBox.Text.Trim();
    if (string.IsNullOrEmpty(installDir)) { Fail("Klasör seçin!"); return; }

    try {
      // Prepare
      UpdateStatus("Başlatılıyor...", 0);
      exeData = File.ReadAllBytes(Assembly.GetExecutingAssembly().Location);
      zipSize = BitConverter.ToInt32(exeData, exeData.Length - 4);
      zipStart = exeData.Length - 4 - zipSize;
      extractDir = Path.Combine(Path.GetTempPath(), "SiramatikSetup");

      // Download Node.js if needed
      if (nodeMissing && internetOk) {
        UpdateStatus("Node.js indiriliyor...", 5);
        await DownloadNodeJs(installDir);
      }

      // Extract ZIP
      UpdateStatus("Dosyalar çıkarılıyor...", 20);
      if (Directory.Exists(extractDir)) Directory.Delete(extractDir, true);
      Directory.CreateDirectory(extractDir);
      ExtractZip();
      Log("[OK] Dosyalar çıkarıldı");

      // Copy files
      UpdateStatus("Dosyalar kopyalanıyor...", 40);
      CopyDir(Path.Combine(extractDir, "server"), Path.Combine(installDir, "server"));
      CopyDir(Path.Combine(extractDir, "client"), Path.Combine(installDir, "client"));
      CopyDir(Path.Combine(extractDir, "shared"), Path.Combine(installDir, "shared"));
      string releaseSrc = Path.Combine(extractDir, "release");
      if (Directory.Exists(releaseSrc)) CopyDir(releaseSrc, Path.Combine(installDir, "release"));
      string pkgSrc = Path.Combine(extractDir, "package.json");
      if (File.Exists(pkgSrc)) File.Copy(pkgSrc, Path.Combine(installDir, "package.json"), true);
      Log("[OK] Dosyalar kopyalandı");

      // npm install
      UpdateStatus("Bağımlılıklar yükleniyor...", 60);
      await RunNpmInstall(installDir);
      Log("[OK] Bağımlılıklar yüklendi");

      // Configure
      UpdateStatus("Yapılandırma yapılıyor...", 85);
      CreateEnvFile(installDir);
      CreateStartupFiles(installDir);
      CreateDesktopShortcut(installDir);
      AddFirewallRule();
      Log("[OK] Yapılandırma tamam");

      // Done
      UpdateStatus("Kurulum tamamlandı!", 100);
      Log("");
      Log("========================================");
      Log("KURULUM TAMAMLANDI!");
      Log("Sunucu: " + installDir);
      Log("Admin: http://localhost:3000/admin");
      Log("Başlat: " + installDir + @"\baslat.bat");
      Log("========================================");
      installBtn.Text = "TAMAM";
      installBtn.Click -= InstallClick;
      installBtn.Click += (s2, e2) => Close();
      installBtn.Enabled = true;
    } catch (Exception ex) {
      Fail("Hata: " + ex.Message);
    } finally {
      installing = false;
      try { if (Directory.Exists(extractDir)) Directory.Delete(extractDir, true); } catch { }
    }
  }

  async Task DownloadNodeJs(string installDir) {
    string url = "https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip";
    string zipPath = Path.Combine(Path.GetTempPath(), "node-download.zip");

    using (var wc = new WebClient()) {
      wc.DownloadProgressChanged += (o, e) => {
        int pct = 5 + (int)(e.ProgressPercentage * 0.12);
        progressBar.Value = Math.Min(pct, 20);
        statusLabel.Text = "Node.js indiriliyor... %" + e.ProgressPercentage;
      };
      await wc.DownloadFileTaskAsync(url, zipPath);
    }
    Log("[OK] Node.js indirildi");

    string nodeDir = Path.Combine(installDir, "node");
    Directory.CreateDirectory(nodeDir);
    ZipFile.ExtractToDirectory(zipPath, Path.Combine(Path.GetTempPath(), "node-extract"));
    string extracted = Path.Combine(Path.GetTempPath(), "node-extract", "node-v22.14.0-win-x64");
    if (Directory.Exists(extracted)) CopyDir(extracted, nodeDir);
    File.Delete(zipPath);
    try { Directory.Delete(Path.Combine(Path.GetTempPath(), "node-extract"), true); } catch { }
    Log("[OK] Node.js v22.14.0 hazır");
  }

  void ExtractZip() {
    using (var ms = new MemoryStream(exeData, zipStart, zipSize))
    using (var archive = new ZipArchive(ms)) {
      int total = archive.Entries.Count;
      int done = 0;
      foreach (var entry in archive.Entries) {
        string dest = Path.Combine(extractDir, entry.FullName);
        if (string.IsNullOrEmpty(entry.Name)) {
          Directory.CreateDirectory(dest);
        } else {
          Directory.CreateDirectory(Path.GetDirectoryName(dest));
          using (var src = entry.Open())
          using (var dst = File.Create(dest)) {
            src.CopyTo(dst);
          }
        }
        done++;
        if (done % 20 == 0) {
          progressBar.Value = 20 + (done * 15 / Math.Max(total, 1));
          Application.DoEvents();
        }
      }
    }
  }

  async Task RunNpmInstall(string installDir) {
    string npmPath = FindNode();
    bool useBundled = false;
    string bundledNode = Path.Combine(installDir, "node", "node.exe");
    if (File.Exists(bundledNode)) { npmPath = bundledNode; useBundled = true; }

    if (npmPath == null) { Log("[!] Node.js bulunamadı, npm atlanıyor"); return; }

    string args;
    if (useBundled) {
      string npmCli = Path.Combine(installDir, "node", "node_modules", "npm", "bin", "npm-cli.js");
      args = "\"" + npmCli + "\" install --production --legacy-peer-deps --ignore-scripts";
    } else {
      npmPath = "cmd.exe";
      args = "/c npm install --production --legacy-peer-deps --ignore-scripts";
    }

    var psi = new ProcessStartInfo {
      FileName = npmPath, Arguments = args, WorkingDirectory = installDir,
      UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true,
      CreateNoWindow = true,
    };
    if (useBundled) {
      psi.EnvironmentVariables["PATH"] = Path.GetDirectoryName(npmPath) + ";" + Environment.GetEnvironmentVariable("PATH");
    }

    var tcs = new TaskCompletionSource<bool>();
    using (var proc = new Process { StartInfo = psi, EnableRaisingEvents = true }) {
      proc.OutputDataReceived += (o, e) => { if (e.Data != null) { Log(e.Data); Application.DoEvents(); } };
      proc.ErrorDataReceived += (o, e) => {
        if (e.Data != null && !e.Data.Contains("deprecated") && !e.Data.Contains("warn") && !e.Data.Contains("npm notice"))
          { Log(e.Data); Application.DoEvents(); }
      };
      proc.Exited += (o, e) => tcs.TrySetResult(true);
      proc.Start();
      proc.BeginOutputReadLine();
      proc.BeginErrorReadLine();
      await Task.Run(() => tcs.Task.Wait(600000));
      proc.WaitForExit();
      if (proc.ExitCode != 0) throw new Exception("npm install başarısız (exit code: " + proc.ExitCode + ")");
    }
  }

  void CreateEnvFile(string installDir) {
    string envPath = Path.Combine(installDir, ".env");
    if (!File.Exists(envPath)) {
      string env = "NODE_ENV=production\r\nPORT=3000\r\nJWT_SECRET=" + Guid.NewGuid().ToString("N") + "\r\n";
      File.WriteAllText(envPath, env);
      Log("[OK] .env dosyası oluşturuldu");
    } else {
      Log("[OK] .env dosyası mevcut");
    }
  }

  void CreateStartupFiles(string installDir) {
    string nodeExe = Path.Combine(installDir, "node", "node.exe");
    string nodePath = File.Exists(nodeExe) ? nodeExe : "node";
    string bat = "@echo off\r\ncd /d \"" + installDir + "\"\r\nset NODE_ENV=production\r\nset PATH=%CD%\\node;%PATH%\r\nstart /B " + nodePath + " server\\index.js\r\necho Siramatik sunucusu calisiyor.\r\necho Admin panel: http://localhost:3000/admin\r\npause\r\n";
    File.WriteAllText(Path.Combine(installDir, "baslat.bat"), bat);

    try {
      using (var p = Process.Start(new ProcessStartInfo("schtasks", "/Create /TN \"SiramatikServer\" /TR \"'" + installDir + "\\baslat.bat'\" /SC ONSTART /DELAY 0001:00 /RL HIGHEST /F") {
        CreateNoWindow = true, UseShellExecute = false
      })) { if (p != null) p.WaitForExit(5000); }
    } catch { }
  }

  void CreateDesktopShortcut(string installDir) {
    try {
      string ps = "$WS=New-Object -ComObject WScript.Shell;$lnk=$WS.CreateShortcut([Environment]::GetFolderPath('Desktop')+'\\Siramatik Admin.lnk');$lnk.TargetPath='" + installDir + "\\baslat.bat';$lnk.Description='Siramatik Admin Paneli';$lnk.Save()";
      using (var p = Process.Start(new ProcessStartInfo("powershell", "-NoProfile -Command \"" + ps.Replace("\"", "\\\"") + "\"") {
        CreateNoWindow = true, UseShellExecute = false
      })) { if (p != null) p.WaitForExit(3000); }
    } catch { }
  }

  void AddFirewallRule() {
    try {
      using (var p = Process.Start(new ProcessStartInfo("netsh", "advfirewall firewall add rule name=\"Siramatik Server\" dir=in action=allow protocol=TCP localport=3000") {
        CreateNoWindow = true, UseShellExecute = false
      })) { if (p != null) p.WaitForExit(3000); }
    } catch { }
  }

  void CopyDir(string src, string dst) {
    Directory.CreateDirectory(dst);
    string[] files = Directory.GetFiles(src, "*", SearchOption.AllDirectories);
    int total = files.Length;
    for (int i = 0; i < total; i++) {
      string rel = files[i].Substring(src.Length).TrimStart('\\', '/');
      string destFile = Path.Combine(dst, rel);
      Directory.CreateDirectory(Path.GetDirectoryName(destFile));
      File.Copy(files[i], destFile, true);
      if (i % 50 == 0) Application.DoEvents();
    }
  }

  void Log(string msg) {
    if (logBox.InvokeRequired) {
      logBox.Invoke((MethodInvoker)(() => Log(msg)));
      return;
    }
    logBox.AppendText(msg + "\n");
    logBox.ScrollToCaret();
  }

  void UpdateStatus(string text, int progress) {
    if (statusLabel.InvokeRequired) {
      statusLabel.Invoke((MethodInvoker)(() => UpdateStatus(text, progress)));
      return;
    }
    statusLabel.Text = text;
    if (progress >= 0) progressBar.Value = Math.Min(progress, 100);
  }

  void Fail(string msg) {
    Log("[!] " + msg);
    UpdateStatus("HATA: " + msg, 0);
    installBtn.Enabled = true;
    MessageBox.Show(msg, "Kurulum Hatası", MessageBoxButtons.OK, MessageBoxIcon.Error);
  }

  [STAThread]
  static void Main() {
    Application.EnableVisualStyles();
    Application.SetCompatibleTextRenderingDefault(false);
    Application.Run(new ServerInstallerForm());
  }
}
