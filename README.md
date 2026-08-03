# Crazy_Tide

CrazyTide 是一款以生物构筑、基地经营和领土远征为核心的单机策略游戏。本仓库用于 GitHub Pages 外部测试。

## 在线版本

GitHub Pages 从 `main` 分支的仓库根目录发布。根目录中的 `index.html`、`assets/`、`favicon.svg` 与 `.nojekyll` 是可直接运行的静态成品。

## 源码

完整开发文件保存在 `source/`。本地开发与重新构建：

```bash
cd source
npm install
npm run dev
npm run build:pages
```

重新构建后，将 `source/docs/` 的内容同步到仓库根目录，再提交更新。
