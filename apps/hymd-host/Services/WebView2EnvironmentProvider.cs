using System.IO;
using Microsoft.Web.WebView2.Core;

namespace HyMd.Host.Services;

internal static class WebView2EnvironmentProvider
{
    private static readonly object Sync = new();
    private static Task<CoreWebView2Environment>? _environmentTask;

    public static Task<CoreWebView2Environment> GetOrCreateAsync()
    {
        lock (Sync)
        {
            _environmentTask ??= CreateEnvironmentAsync();
            return _environmentTask;
        }
    }

    private static Task<CoreWebView2Environment> CreateEnvironmentAsync()
    {
        string userDataFolder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "HYmd",
            "WebView2");
        Directory.CreateDirectory(userDataFolder);
        return CoreWebView2Environment.CreateAsync(null, userDataFolder);
    }
}
