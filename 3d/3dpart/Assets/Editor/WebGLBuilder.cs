#if UNITY_EDITOR
using System;
using System.Globalization;
using System.IO;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

public static class WebGLBuilder
{
    [MenuItem("Feiyi/Build WebGL 3D UI New")]
    public static void Build3dUiNew()
    {
        string projectRoot = Directory.GetParent(Application.dataPath).FullName;
        string outputPath = Path.Combine(projectRoot, "3d_ui_new");
        string[] scenes = { "Assets/Scenes/SampleScene.unity" };

        EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.WebGL, BuildTarget.WebGL);

        BuildPlayerOptions options = new BuildPlayerOptions
        {
            scenes = scenes,
            locationPathName = outputPath,
            target = BuildTarget.WebGL,
            options = BuildOptions.None,
        };

        BuildReport report = BuildPipeline.BuildPlayer(options);
        BuildSummary summary = report.summary;
        if (summary.result != BuildResult.Succeeded)
        {
            throw new Exception("WebGL build failed: " + summary.result);
        }

        PatchIndexCacheBust(Path.Combine(outputPath, "index.html"));
        SyncBuildToFrontendPublic(projectRoot, outputPath);
        Debug.Log("WebGL build succeeded: " + outputPath);
    }

    private static void PatchIndexCacheBust(string indexPath)
    {
        if (!File.Exists(indexPath))
        {
            Debug.LogWarning("WebGL index.html not found for cache patch: " + indexPath);
            return;
        }

        string version = DateTime.UtcNow.ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture);
        string html = File.ReadAllText(indexPath);
        html = Regex.Replace(
            html,
            "var buildUrl = \"Build\";\\s*(?:var buildVersion = \"[^\"]+\";\\s*)?",
            "var buildUrl = \"Build\";\n      var buildVersion = \"" + version + "\";\n      "
        );
        html = Regex.Replace(
            html,
            "var loaderUrl = buildUrl \\+ \"(/[^\"\r\n]+?\\.loader\\.js)(?:\\?v=\" \\+ buildVersion)?\";",
            "var loaderUrl = buildUrl + \"$1?v=\" + buildVersion;"
        );
        html = Regex.Replace(
            html,
            "dataUrl: buildUrl \\+ \"(/[^\"\r\n]+?\\.data)(?:\\?v=\" \\+ buildVersion)?\",",
            "dataUrl: buildUrl + \"$1?v=\" + buildVersion,"
        );
        html = Regex.Replace(
            html,
            "frameworkUrl: buildUrl \\+ \"(/[^\"\r\n]+?\\.framework\\.js)(?:\\?v=\" \\+ buildVersion)?\",",
            "frameworkUrl: buildUrl + \"$1?v=\" + buildVersion,"
        );
        html = Regex.Replace(
            html,
            "codeUrl: buildUrl \\+ \"(/[^\"\r\n]+?\\.wasm)(?:\\?v=\" \\+ buildVersion)?\",",
            "codeUrl: buildUrl + \"$1?v=\" + buildVersion,"
        );
        File.WriteAllText(indexPath, html);
        Debug.Log("Patched WebGL index cache version: " + version);
    }

    private static void SyncBuildToFrontendPublic(string projectRoot, string outputPath)
    {
        string workspaceRoot = Directory.GetParent(Directory.GetParent(projectRoot).FullName).FullName;
        string destination = Path.Combine(workspaceRoot, "frontend", "public", "3d-ui-new");

        Directory.CreateDirectory(destination);
        DeletePath(Path.Combine(destination, "index.html"));
        DeletePath(Path.Combine(destination, "Build"));
        DeletePath(Path.Combine(destination, "TemplateData"));
        DeletePath(Path.Combine(destination, "StreamingAssets"));

        File.Copy(Path.Combine(outputPath, "index.html"), Path.Combine(destination, "index.html"), true);
        CopyDirectory(Path.Combine(outputPath, "Build"), Path.Combine(destination, "Build"));
        CopyDirectory(Path.Combine(outputPath, "TemplateData"), Path.Combine(destination, "TemplateData"));

        string streamingAssets = Path.Combine(outputPath, "StreamingAssets");
        if (Directory.Exists(streamingAssets))
        {
            CopyDirectory(streamingAssets, Path.Combine(destination, "StreamingAssets"));
        }

        Debug.Log("Synced WebGL build to frontend public: " + destination);
    }

    private static void DeletePath(string path)
    {
        if (File.Exists(path))
        {
            File.Delete(path);
        }
        else if (Directory.Exists(path))
        {
            Directory.Delete(path, true);
        }
    }

    private static void CopyDirectory(string source, string destination)
    {
        Directory.CreateDirectory(destination);

        foreach (string directory in Directory.GetDirectories(source, "*", SearchOption.AllDirectories))
        {
            Directory.CreateDirectory(directory.Replace(source, destination));
        }

        foreach (string file in Directory.GetFiles(source, "*", SearchOption.AllDirectories))
        {
            File.Copy(file, file.Replace(source, destination), true);
        }
    }
}
#endif
