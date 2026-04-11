# DPeakPanel

`DPeakPanel` 是基于 [gdy666/LuckyLightPanel](https://github.com/gdy666/LuckyLightPanel) 持续整理和扩展的个人导航面板项目，当前版本重点补充了更适合服务器场景的 Docker 部署方式，以及更完整的前端编辑、图标管理和登录权限能力。

## Docker 快速开始

如果你希望面板中的 Docker 页面显示宿主机真实容器状态，请务必挂载 Docker Socket。

```bash
docker run -d \
  --name dpeakpanel \
  --restart unless-stopped \
  -p 5173:5173 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  ghcr.io/dpeak0/dpeakpanel:latest
```

访问地址：

```text
http://服务器IP:5173
```

## 登录与权限

- 首次启用时默认管理员账号为 `admin`
- 默认密码为 `admin123`
- 登录后建议立即修改管理员密码
- 只有管理员可以看到设置入口
- 普通用户只保留被授权分组的查看权限

## 致谢

本项目基于以下开源项目持续演进：

- [gdy666/LuckyLightPanel](https://github.com/gdy666/LuckyLightPanel)
- [hslr-s/sun-panel](https://github.com/hslr-s/sun-panel)
