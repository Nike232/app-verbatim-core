# App Verbatim Core

面向命令行与 Node.js 的 App Store、Google Play 评论证据分析工具。

App Verbatim Core 把公开应用评论转换为确定性的主题、版本信号、竞品差距和行动建议，并为每条结论保留原始评论证据。默认完全本地运行，不需要账户、数据库或 AI Key。

## 快速开始

要求 Node.js 22.12 或更高版本。

```bash
git clone https://github.com/Nike232/app-verbatim-core.git
cd app-verbatim-core
npm ci
npm run start -- demo --compare --output report.html
```

这是完全离线的合成数据示例。真实分析：

```bash
npm run start -- analyze "https://play.google.com/store/apps/details?id=notion.id" \
  --country US --language en --limit 200 --output report.html
```

支持 JSON、CSV、Markdown 和独立 HTML。详细命令、Node.js API、自定义连接器示例和验证方式见 [英文 README](README.md)。

## 当前边界

本仓库只承载可公开复用的 Core：

- App Store、Google Play 公共评论连接器；
- 统一评论模型、去重、主题、趋势、版本与竞品分析；
- 原始证据和数据集哈希；
- CLI、Node.js API 与连接器扩展契约；
- JSON、CSV、Markdown、HTML 导出；
- 离线夹具、测试和兼容性检查。

托管调度、长期历史、告警、团队权限、私有所有者接口和商业运维属于独立的私有 Pro 代码库，不会藏在本仓库的某个公开分支里。现有产品应用在 Core 稳定前也保持不动。

## 验证

```bash
npm ci
npm run check
```

真实商店连接器测试需要显式启用：

```bash
APP_VERBATIM_LIVE_TESTS=1 npm run test:live
```

## 许可证

GNU AGPL-3.0-or-later。详见 [LICENSE](LICENSE) 与 [NOTICE.md](NOTICE.md)。软件许可证不授予产品名称和视觉标识的商标权。
