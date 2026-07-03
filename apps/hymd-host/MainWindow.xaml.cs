using System.IO;
using System.Text;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using Newtonsoft.Json.Linq;
using HyMd.Host.Services;

namespace HyMd.Host;

public partial class MainWindow : Window
{
    private const string VirtualHost = "hymd.local";
    private const string EntryUrl = "https://hymd.local/index.html";

    private readonly DocumentHostState _state = new();
    private FileSystemWatcher? _watcher;
    private bool _webviewReady;
    private bool _overlayOpen;

    public MainWindow()
    {
        InitializeComponent();
        Loaded += OnLoadedAsync;
        Closing += OnClosing;
        KeyDown += OnKeyDown;
    }

    private async void OnLoadedAsync(object sender, RoutedEventArgs e)
    {
        try
        {
            await InitializeWebViewAsync();
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "HyMD Host", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private async Task InitializeWebViewAsync()
    {
        string distPath = ResolveDistPath();
        if (!Directory.Exists(distPath))
            throw new DirectoryNotFoundException($"未找到 Web 资源: {distPath}");

        string runtime = CoreWebView2Environment.GetAvailableBrowserVersionString();
        if (string.IsNullOrWhiteSpace(runtime))
            throw new InvalidOperationException("请先安装 Microsoft Edge WebView2 Runtime。");

        var env = await WebView2EnvironmentProvider.GetOrCreateAsync();
        await EditorWebView.EnsureCoreWebView2Async(env);

        EditorWebView.CoreWebView2.Settings.AreDevToolsEnabled = true;
        EditorWebView.CoreWebView2.SetVirtualHostNameToFolderMapping(
            VirtualHost,
            distPath,
            CoreWebView2HostResourceAccessKind.Allow);

        EditorWebView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
        EditorWebView.CoreWebView2.Navigate(EntryUrl);

        NewDocument();
    }

    private static string ResolveDistPath()
    {
        string baseDir = AppContext.BaseDirectory;
        string candidate = Path.Combine(baseDir, "Web", "dist");
        if (Directory.Exists(candidate))
            return candidate;

        candidate = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "packages", "hymd-host-web", "dist"));
        return candidate;
    }

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            var json = JObject.Parse(e.WebMessageAsJson);
            string? type = json["type"]?.Value<string>();
            if (type == null) return;

            Dispatcher.Invoke(() => HandleWebMessage(type, json));
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine(ex);
        }
    }

    private void HandleWebMessage(string type, JObject json)
    {
        switch (type)
        {
            case "ready":
                _webviewReady = true;
                PushInit();
                break;
            case "edit":
                if (_overlayOpen) return;
                string content = json["content"]?.Value<string>() ?? "";
                int version = json["version"]?.Value<int>() ?? 0;
                if (!_state.OnWebviewEdit(content, version)) return;
                _state.MarkDirty();
                UpdateTitle();
                if (!string.IsNullOrWhiteSpace(_state.FilePath))
                    SaveDocument(_state.FilePath);
                break;
            case "overlayState":
                _overlayOpen = json["open"]?.Value<bool>() ?? false;
                break;
            case "readFile":
                HandleReadFile(json);
                break;
            case "writeFile":
                HandleWriteFile(json);
                break;
            case "log":
                System.Diagnostics.Debug.WriteLine("[webview] " + json["message"]);
                break;
        }
    }

    private void HandleReadFile(JObject json)
    {
        string requestId = json["requestId"]?.Value<string>() ?? "";
        string relPath = json["relPath"]?.Value<string>() ?? "";
        try
        {
            string abs = ResolveSafePath(relPath);
            string content = File.Exists(abs) ? File.ReadAllText(abs, Encoding.UTF8) : "";
            PostToWebview(new JObject
            {
                ["type"] = "fileResult",
                ["requestId"] = requestId,
                ["ok"] = true,
                ["content"] = content,
            });
        }
        catch (Exception ex)
        {
            PostToWebview(new JObject
            {
                ["type"] = "fileResult",
                ["requestId"] = requestId,
                ["ok"] = false,
                ["error"] = ex.Message,
            });
        }
    }

    private void HandleWriteFile(JObject json)
    {
        string requestId = json["requestId"]?.Value<string>() ?? "";
        string relPath = json["relPath"]?.Value<string>() ?? "";
        string content = json["content"]?.Value<string>() ?? "";
        try
        {
            string abs = ResolveSafePath(relPath);
            string? dir = Path.GetDirectoryName(abs);
            if (!string.IsNullOrEmpty(dir))
                Directory.CreateDirectory(dir);
            File.WriteAllText(abs, content, Encoding.UTF8);
            PostToWebview(new JObject
            {
                ["type"] = "fileResult",
                ["requestId"] = requestId,
                ["ok"] = true,
            });
        }
        catch (Exception ex)
        {
            PostToWebview(new JObject
            {
                ["type"] = "fileResult",
                ["requestId"] = requestId,
                ["ok"] = false,
                ["error"] = ex.Message,
            });
        }
    }

    private string ResolveSafePath(string relPath)
    {
        if (string.IsNullOrWhiteSpace(_state.DocumentDirectory))
            throw new InvalidOperationException("尚未打开文档，无法读写附属文件。");

        string normalized = relPath.Replace('\\', '/').TrimStart('.', '/');
        string target = Path.GetFullPath(Path.Combine(_state.DocumentDirectory, normalized));
        string docDir = Path.GetFullPath(_state.DocumentDirectory);

        if (!target.StartsWith(docDir, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"路径越界: {relPath}");

        return target;
    }

    private void PushInit()
    {
        if (!_webviewReady) return;

        PostToWebview(new JObject
        {
            ["type"] = "init",
            ["content"] = _state.Body,
            ["theme"] = "light",
            ["uiStyle"] = "hymd",
            ["documentPath"] = _state.FilePath ?? "",
            ["frontmatter"] = _state.Frontmatter,
        });
        _state.ClearDirty();
        UpdateTitle();
    }

    private void PostToWebview(JObject message)
    {
        if (EditorWebView.CoreWebView2 == null) return;
        EditorWebView.CoreWebView2.PostWebMessageAsString(message.ToString());
    }

    private void NewDocument()
    {
        _state.SetNewDocument();
        SetupWatcher(null);
        if (_webviewReady) PushInit();
        else UpdateTitle();
    }

    private void OpenDocument(string path)
    {
        string text = File.ReadAllText(path, Encoding.UTF8);
        _state.LoadFromFile(path, text);
        SetupWatcher(path);
        if (_webviewReady) PushInit();
        else UpdateTitle();
    }

    private void SaveDocument(string? path = null)
    {
        string target = path ?? _state.FilePath ?? PromptSavePath();
        if (string.IsNullOrWhiteSpace(target)) return;

        string full = _state.BuildFullMarkdown();
        string? dir = Path.GetDirectoryName(target);
        if (!string.IsNullOrEmpty(dir))
            Directory.CreateDirectory(dir);

        File.WriteAllText(target, full, Encoding.UTF8);
        _state.SetSavedPath(target);
        SetupWatcher(target);
        _state.ClearDirty();
        UpdateTitle();
    }

    private static string PromptSavePath()
    {
        var dlg = new SaveFileDialog
        {
            Filter = "HyMD 文档|*.hy.md;*.md|所有文件|*.*",
            DefaultExt = ".hy.md",
            FileName = "未命名.hy.md",
        };
        return dlg.ShowDialog() == true ? dlg.FileName : "";
    }

    private void SetupWatcher(string? filePath)
    {
        _watcher?.Dispose();
        _watcher = null;
        if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath)) return;

        string dir = Path.GetDirectoryName(filePath)!;
        string name = Path.GetFileName(filePath);
        _watcher = new FileSystemWatcher(dir, name)
        {
            NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.Size,
        };
        _watcher.Changed += OnExternalFileChanged;
        _watcher.EnableRaisingEvents = true;
    }

    private void OnExternalFileChanged(object sender, FileSystemEventArgs e)
    {
        Dispatcher.Invoke(() =>
        {
            if (_state.IsDirty)
            {
                ReloadPrompt.Visibility = Visibility.Visible;
                return;
            }

            try
            {
                Thread.Sleep(100);
                string text = File.ReadAllText(e.FullPath, Encoding.UTF8);
                int version = _state.NextExternalVersion();
                if (!_state.ShouldApplyExternal(text, version)) return;
                _state.ApplyExternalContent(text);
                PostToWebview(new JObject
                {
                    ["type"] = "externalUpdate",
                    ["content"] = _state.Body,
                    ["version"] = version,
                });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine(ex);
            }
        });
    }

    private void UpdateTitle()
    {
        string name = string.IsNullOrWhiteSpace(_state.FilePath)
            ? "未命名"
            : Path.GetFileName(_state.FilePath);
        Title = (_state.IsDirty ? "* " : "") + name + " — HyMD Editor";
    }

    private void OnNewClick(object sender, RoutedEventArgs e) => ConfirmDiscard(() => NewDocument());

    private void OnOpenClick(object sender, RoutedEventArgs e)
    {
        ConfirmDiscard(() =>
        {
            var dlg = new OpenFileDialog
            {
                Filter = "HyMD 文档|*.hy.md;*.md|所有文件|*.*",
            };
            if (dlg.ShowDialog() == true)
                OpenDocument(dlg.FileName);
        });
    }

    private void OnSaveClick(object sender, RoutedEventArgs e)
    {
        if (string.IsNullOrWhiteSpace(_state.FilePath))
            SaveDocument(PromptSavePath());
        else
            SaveDocument();
    }

    private void OnSaveAsClick(object sender, RoutedEventArgs e) => SaveDocument(PromptSavePath());

    private void OnExitClick(object sender, RoutedEventArgs e) => Close();

    private void OnReloadExternalClick(object sender, RoutedEventArgs e)
    {
        ReloadPrompt.Visibility = Visibility.Collapsed;
        if (string.IsNullOrWhiteSpace(_state.FilePath)) return;
        OpenDocument(_state.FilePath);
    }

    private void OnDismissReloadClick(object sender, RoutedEventArgs e)
    {
        ReloadPrompt.Visibility = Visibility.Collapsed;
    }

    private void OnKeyDown(object sender, System.Windows.Input.KeyEventArgs e)
    {
        if (e.Key == System.Windows.Input.Key.S && System.Windows.Input.Keyboard.Modifiers == System.Windows.Input.ModifierKeys.Control)
        {
            OnSaveClick(this, new RoutedEventArgs());
            e.Handled = true;
        }
        else if (e.Key == System.Windows.Input.Key.O && System.Windows.Input.Keyboard.Modifiers == System.Windows.Input.ModifierKeys.Control)
        {
            OnOpenClick(this, new RoutedEventArgs());
            e.Handled = true;
        }
        else if (e.Key == System.Windows.Input.Key.N && System.Windows.Input.Keyboard.Modifiers == System.Windows.Input.ModifierKeys.Control)
        {
            OnNewClick(this, new RoutedEventArgs());
            e.Handled = true;
        }
    }

    private void ConfirmDiscard(Action action)
    {
        if (!_state.IsDirty)
        {
            action();
            return;
        }

        var result = MessageBox.Show(this, "文档已修改，是否放弃更改？", "HyMD Editor",
            MessageBoxButton.YesNoCancel, MessageBoxImage.Question);
        if (result == MessageBoxResult.Yes)
            action();
    }

    private void OnClosing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        if (!_state.IsDirty) return;
        var result = MessageBox.Show(this, "文档已修改，是否保存？", "HyMD Editor",
            MessageBoxButton.YesNoCancel, MessageBoxImage.Question);
        if (result == MessageBoxResult.Cancel)
        {
            e.Cancel = true;
            return;
        }

        if (result == MessageBoxResult.Yes)
            SaveDocument();
    }
}
