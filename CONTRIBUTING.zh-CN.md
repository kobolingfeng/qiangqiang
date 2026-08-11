# 为强强贡献

[English guide](CONTRIBUTING.md)

感谢你帮助强强成为更轻量、更安全、更适合 AI 开发的 Windows 应用框架。

## 提交 Issue 前

- 先搜索已有 Issue 和文档。
- 可复现的框架缺陷使用 Bug 模板，新想法使用功能建议模板。
- 使用问题和应用设计讨论请优先使用 GitHub Discussions。
- 安全漏洞请按照 [SECURITY.md](SECURITY.md) 私下报告。

## 开发环境

维护强强需要 Windows 10/11、Bun 1.3.14 或更高版本，以及安装了“使用 C++ 的桌面开发”的 Visual Studio Build Tools 2022。

```powershell
bun install
bun run setup
bun run check
bun run test
bun run build:single
```

`dist/`、`release/`、`deps/` 和 `native/build/` 是生成或下载目录，请勿提交。

## 修改位置

- 原生 API 与窗口行为：`native/main.cpp`
- 公共 TypeScript API：`src/api.ts`
- IPC 传输：`src/ipc.ts`
- 框架工具：`scripts/`
- 示例应用：`src/main.ts` 和 `src/index.html`
- 用户文档：`README.md` 与 `README.en.md` 应保持技术内容一致

本仓库用于维护框架本身。具体应用应在独立脚手架中开发，不要把这里的示例直接改成某个产品工程。

## 修改流程

1. Fork 仓库，从 `main` 创建聚焦单一目标的分支。
2. 控制修改范围，并清楚说明用户可见行为。
3. 为 Bug 修复和可复用工具逻辑增加测试。
4. API 或行为变化需同步更新公共类型和中英文 README。
5. 执行相关验证：

```powershell
bun run check
bun run test
bun run build:frontend  # 纯前端修改的最低要求
bun run build:single    # 原生、IPC、构建、打包或资源修改必须执行
```

## 新增原生 API 检查表

- 在 `native/main.cpp` 注册处理器并验证输入。
- 进程、网络或长时间文件操作必须使用异步 IPC。
- 在 `src/api.ts` 添加类型化封装和返回类型。
- 检查权限、注入、路径边界、超时、输出上限、编码和句柄生命周期。
- 在中英文 README 中记录命令与事件。
- 在可行范围内增加聚焦的回归测试。

## Pull Request 要求

- 简明说明问题与解决方案
- 关联相关 Issue
- 可见 UI 变化附截图或录屏
- 列出实际执行的验证命令与结果
- 说明兼容性或安全影响
- 不包含生成物、本机配置、密钥或无关格式化

提交贡献即表示你同意按本仓库的 [MIT License](LICENSE) 许可该贡献。
