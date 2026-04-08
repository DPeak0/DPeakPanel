# DPeakPanel

`DPeakPanel` 是基于 [gdy666/LuckyLightPanel](https://github.com/gdy666/LuckyLightPanel) 二次整理的前端面板项目，当前版本主要补充了更直接的 Docker 部署方式，方便在服务器或容器环境中快速运行。

## 项目说明

- 基于原项目 `LuckyLightPanel` 维护
- 保留原有前端面板能力
- 增加 Docker 镜像构建与部署支持
- 支持通过 GitHub Actions 自动构建并发布镜像到 GHCR

## Docker 部署

### 方式一：直接使用 GHCR 镜像

```bash
docker pull ghcr.io/dpeak0/dpeakpanel:latest
docker run -d \
  --name dpeakpanel \
  --restart unless-stopped \
  -p 18080:80 \
  ghcr.io/dpeak0/dpeakpanel:latest
```

访问地址：

```text
http://服务器IP:18080
```

### 方式二：在本地构建并运行

```bash
git clone git@github.com:DPeak0/DPeakPanel.git
cd DPeakPanel
docker compose up -d --build
```

默认同样监听：

```text
http://服务器IP:18080
```

## 常用命令

```bash
# 启动
docker compose up -d

# 重建并启动
docker compose up -d --build

# 查看日志
docker compose logs -f

# 停止
docker compose down
```

## 镜像发布

仓库已接入 GitHub Actions 自动构建 Docker 镜像。

- 推送到 `main` 时自动构建镜像
- 推送 `v*` 标签时自动发布版本镜像
- 镜像默认发布到 `ghcr.io/dpeak0/dpeakpanel`

GHCR 页面：

- `https://github.com/DPeak0/DPeakPanel/pkgs/container/dpeakpanel`

## 本地开发

如果你需要自行修改前端代码，可以使用：

```bash
pnpm install
pnpm dev
```

生产构建：

```bash
pnpm build
```

## 致谢

本项目基于以下项目进行二次整理：

- [gdy666/LuckyLightPanel](https://github.com/gdy666/LuckyLightPanel)
