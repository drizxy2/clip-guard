# Clip Guard

Clip Guard 是一款实验性浏览器扩展，会在可疑 shell 命令写入剪贴板或粘贴到网页之前发出提醒。启发式检测可能误报或漏报；它不能替代操作系统的安全防护。

## 安装

下载并解压[最新版本](https://github.com/drizxy2/clip-guard/releases)。

- **Chrome、Edge、Brave 及其他 Chromium 浏览器：**打开 `chrome://extensions` 或 `edge://extensions`，启用开发者模式，选择**加载已解压的扩展程序**，然后选择包含 `manifest.json` 的解压文件夹。
- **Firefox：**在扩展通过 AMO 签名并发布之前，可在 `about:debugging#/runtime/this-firefox` 临时加载，选择解压后的 `manifest.json`。关闭 Firefox 后，临时扩展会被移除。

## 保护与隐私

阻止模式会暂停可疑的剪贴板写入或粘贴，等待你决定；仅提醒模式会允许操作并显示提醒。Clip Guard 不会发起网络请求，也不会保存剪贴板文本。启用可选的本地测量后，只记录来源、级别、原因和日期。等待你决定的文本会暂时保留在内存中。

界面语言跟随浏览器设置。技术详情请参阅[项目 README](../../README.md)。
