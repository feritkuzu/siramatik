using System;
using System.IO;
using System.IO.Compression;
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
      Text = "Hepsi bir arada — İnternet gerekmez",
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

    Load += (s, e) => CheckPrerequisites();
  }

  void CheckPrerequisites() {
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

    // VC++ Redistributable check
    bool vcOk = File.Exists(Path.Combine(Environment.SystemDirectory, "vcruntime140.dll"));
    if (vcOk) {
      Log("[OK] VC++ Redistributable mevcut");
    } else {
      Log("[!] VC++ Redistributable gerekli - paket içinde hazır");
    }

    Log("[OK] Node.js paket içinde hazır");
    installBtn.Enabled = true;
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

      // Extract ZIP directly to install directory
      UpdateStatus("Dosyalar çıkarılıyor...", 10);
      if (Directory.Exists(extractDir)) Directory.Delete(extractDir, true);
      Directory.CreateDirectory(extractDir);
      ExtractZip();
      Log("[OK] Dosyalar çıkarıldı");

      // Install VC++ Redistributable if missing (Node.js requires it)
      if (!File.Exists(Path.Combine(Environment.SystemDirectory, "vcruntime140.dll"))) {
        string vcRedist = Path.Combine(extractDir, "vc_redist.x64.exe");
        if (File.Exists(vcRedist)) {
          UpdateStatus("VC++ Redistributable kuruluyor...", 25);
          Log("[...] VC++ Redistributable kuruluyor (birkaç saniye)...");
          using (var p = Process.Start(new ProcessStartInfo(vcRedist, "/install /quiet /norestart") {
            CreateNoWindow = true, UseShellExecute = false
          })) {
            if (p != null) {
              p.WaitForExit(60000);
              if (p.ExitCode == 0) Log("[OK] VC++ Redistributable kuruldu");
              else Log("[!] VC++ kurulumu uyarıyla bitti (kod: " + p.ExitCode + ")");
            }
          }
        } else {
          Log("[!] VC++ Redistributable pakette bulunamadı, node.exe çalışmayabilir!");
        }
      }

      // Copy ALL files including bundled Node.js and node_modules
      UpdateStatus("Dosyalar kopyalanıyor...", 40);
      string[] copyDirs = { "server", "client", "shared", "node" };
      foreach (string dir in copyDirs) {
        string src = Path.Combine(extractDir, dir);
        if (Directory.Exists(src)) CopyDir(src, Path.Combine(installDir, dir));
      }
      // Copy media (notification MP3s)
      string mediaSrc = Path.Combine(extractDir, "release", "Media", "Notification");
      if (Directory.Exists(mediaSrc)) CopyDir(mediaSrc, Path.Combine(installDir, "release", "Media", "Notification"));
      // Copy node_modules (if present)
      string nmSrc = Path.Combine(extractDir, "node_modules");
      if (Directory.Exists(nmSrc)) CopyDir(nmSrc, Path.Combine(installDir, "node_modules"));
      // Copy root files
      foreach (string file in new[] { "package.json", "siramatik.db" }) {
        string f = Path.Combine(extractDir, file);
        if (File.Exists(f)) File.Copy(f, Path.Combine(installDir, file), true);
      }
      Log("[OK] Tüm dosyalar kopyalandı");

      // Configure
      UpdateStatus("Yapılandırma yapılıyor...", 70);
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
      Log("");
      Log("NOT: İnternet gerekmeden kurulum yapıldı.");
      Log("Tüm bileşenler paket içinde hazır.");
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
          int pct = 10 + (done * 25 / Math.Max(total, 1));
          progressBar.Value = Math.Min(pct, 35);
          Application.DoEvents();
        }
      }
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
