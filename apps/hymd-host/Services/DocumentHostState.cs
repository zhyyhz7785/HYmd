using System.IO;
using System.Text;

namespace HyMd.Host.Services;

/// <summary>
/// 文档状态：frontmatter 与正文分离，同步 webview 编辑。
/// </summary>
public sealed class DocumentHostState
{
    private int _pendingHostVersion;
    private int _lastAppliedWebviewVersion;
    private int _externalVersion;
    private string _lastKnownBody = "";

    public string FilePath { get; private set; } = "";
    public string DocumentDirectory { get; private set; } = "";
    public string Frontmatter { get; private set; } = "";
    public string Body { get; private set; } = "";
    public bool IsDirty { get; private set; }

    public void SetNewDocument()
    {
        FilePath = "";
        DocumentDirectory = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
        Frontmatter = "---\ntitle: 未命名\n---\n";
        Body = "# 新文档\n\n在此开始写作。\n";
        _lastKnownBody = Body;
        _pendingHostVersion = 0;
        _lastAppliedWebviewVersion = 0;
        IsDirty = true;
    }

    public void LoadFromFile(string path, string fullText)
    {
        var split = SplitFrontmatter(fullText);
        FilePath = path;
        DocumentDirectory = Path.GetDirectoryName(path) ?? "";
        Frontmatter = split.Frontmatter;
        Body = split.Body;
        _lastKnownBody = Body;
        _pendingHostVersion = 0;
        _lastAppliedWebviewVersion = 0;
        IsDirty = false;
    }

    public void ApplyExternalContent(string fullText)
    {
        var split = SplitFrontmatter(fullText);
        Frontmatter = split.Frontmatter;
        Body = split.Body;
        _lastKnownBody = Body;
    }

    public bool OnWebviewEdit(string content, int version)
    {
        if (version <= _lastAppliedWebviewVersion) return false;
        _lastAppliedWebviewVersion = version;
        Body = content;
        _lastKnownBody = content;
        _pendingHostVersion = version;
        return true;
    }

    public void OnHostApplied(int version)
    {
        if (version == _pendingHostVersion)
            _pendingHostVersion = 0;
    }

    public bool ShouldApplyExternal(string fullText, int documentVersion)
    {
        if (_pendingHostVersion != 0) return false;
        var split = SplitFrontmatter(fullText);
        if (split.Body == _lastKnownBody) return false;
        _lastKnownBody = split.Body;
        _lastAppliedWebviewVersion = documentVersion;
        return true;
    }

    public int NextExternalVersion() => ++_externalVersion;

    public string BuildFullMarkdown() => JoinFrontmatter(Frontmatter, Body);

    public void SetSavedPath(string path)
    {
        FilePath = path;
        DocumentDirectory = Path.GetDirectoryName(path) ?? DocumentDirectory;
    }

    public void MarkDirty() => IsDirty = true;

    public void ClearDirty()
    {
        IsDirty = false;
        _pendingHostVersion = 0;
    }

    private static (string Frontmatter, string Body) SplitFrontmatter(string text)
    {
        if (!text.StartsWith("---")) return ("", text);

        int firstLineEnd = text.IndexOf('\n');
        if (firstLineEnd < 0) return ("", text);
        if (text[..firstLineEnd].TrimEnd('\r') != "---") return ("", text);

        int searchFrom = firstLineEnd + 1;
        while (searchFrom <= text.Length)
        {
            int lineEnd = text.IndexOf('\n', searchFrom);
            string rawLine = lineEnd < 0 ? text[searchFrom..] : text[searchFrom..lineEnd];
            if (rawLine.TrimEnd('\r') == "---")
            {
                int end = lineEnd < 0 ? text.Length : lineEnd + 1;
                return (text[..end], text[end..]);
            }
            if (lineEnd < 0) break;
            searchFrom = lineEnd + 1;
        }

        return ("", text);
    }

    private static string JoinFrontmatter(string frontmatter, string body)
    {
        if (string.IsNullOrEmpty(frontmatter)) return body;
        string fm = frontmatter.EndsWith('\n') ? frontmatter : frontmatter + "\n";
        if (body.Length == 0) return fm;
        return body.StartsWith('\n') || body.StartsWith("\r\n") ? fm + body : fm + "\n" + body;
    }
}
