# DPeakPanel

`DPeakPanel` 是基于 [gdy666/LuckyLightPanel](https://github.com/gdy666/LuckyLightPanel) 二次整理的前端面板项目，当前版本主要补充了更直接的 Docker 部署方式，方便在服务器或容器环境中快速运行。

## 项目说明

- 基于原项目 `LuckyLightPanel` 维护
- 保留原有前端面板能力
- 增加 Docker 镜像构建与部署支持

## Docker 部署


```bash
docker pull ghcr.io/dpeak0/dpeakpanel:latest
docker run -d \
  --name dpeakpanel \
  --restart unless-stopped \
  -p 5173:5173 \
  ghcr.io/dpeak0/dpeakpanel:latest
```

访问地址：

```text
http://服务器IP:5173
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



## 致谢

本项目基于以下项目进行二次整理：

- [gdy666/LuckyLightPanel](https://github.com/gdy666/LuckyLightPanel)
