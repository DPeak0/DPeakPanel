export interface SiteIconLibraryItem {
  key: string
  title: string
  slug: string
  keywords: string[]
}

export const SITE_ICON_LIBRARY: SiteIconLibraryItem[] = [
  { key: 'github', title: 'GitHub', slug: 'github', keywords: ['git', 'code', 'repo'] },
  { key: 'gitlab', title: 'GitLab', slug: 'gitlab', keywords: ['git', 'code', 'repo'] },
  { key: 'gitea', title: 'Gitea', slug: 'gitea', keywords: ['git', 'code', 'repo'] },
  { key: 'docker', title: 'Docker', slug: 'docker', keywords: ['container', 'devops'] },
  { key: 'portainer', title: 'Portainer', slug: 'portainer', keywords: ['docker', 'container'] },
  { key: 'nginx', title: 'NGINX', slug: 'nginx', keywords: ['proxy', 'web'] },
  { key: 'traefik', title: 'Traefik', slug: 'traefikproxy', keywords: ['proxy', 'gateway'] },
  { key: 'cloudflare', title: 'Cloudflare', slug: 'cloudflare', keywords: ['dns', 'cdn'] },
  { key: 'grafana', title: 'Grafana', slug: 'grafana', keywords: ['monitor', 'dashboard'] },
  { key: 'prometheus', title: 'Prometheus', slug: 'prometheus', keywords: ['monitor', 'metrics'] },
  { key: 'mysql', title: 'MySQL', slug: 'mysql', keywords: ['database', 'db'] },
  { key: 'mariadb', title: 'MariaDB', slug: 'mariadb', keywords: ['database', 'db'] },
  { key: 'postgresql', title: 'PostgreSQL', slug: 'postgresql', keywords: ['database', 'db', 'postgres'] },
  { key: 'redis', title: 'Redis', slug: 'redis', keywords: ['database', 'cache'] },
  { key: 'mongodb', title: 'MongoDB', slug: 'mongodb', keywords: ['database', 'db'] },
  { key: 'nodejs', title: 'Node.js', slug: 'nodedotjs', keywords: ['javascript', 'runtime'] },
  { key: 'npm', title: 'npm', slug: 'npm', keywords: ['node', 'package'] },
  { key: 'vue', title: 'Vue', slug: 'vuedotjs', keywords: ['frontend', 'javascript'] },
  { key: 'react', title: 'React', slug: 'react', keywords: ['frontend', 'javascript'] },
  { key: 'vite', title: 'Vite', slug: 'vite', keywords: ['build', 'frontend'] },
  { key: 'visualstudiocode', title: 'VS Code', slug: 'visualstudiocode', keywords: ['editor', 'code'] },
  { key: 'firefox', title: 'Firefox', slug: 'firefoxbrowser', keywords: ['browser'] },
  { key: 'googlechrome', title: 'Chrome', slug: 'googlechrome', keywords: ['browser'] },
  { key: 'homeassistant', title: 'Home Assistant', slug: 'homeassistant', keywords: ['smart home', 'iot'] },
  { key: 'proxmox', title: 'Proxmox', slug: 'proxmox', keywords: ['virtualization', 'vm'] },
  { key: 'nextcloud', title: 'Nextcloud', slug: 'nextcloud', keywords: ['cloud', 'drive'] },
  { key: 'synology', title: 'Synology', slug: 'synology', keywords: ['nas', 'storage'] },
  { key: 'jellyfin', title: 'Jellyfin', slug: 'jellyfin', keywords: ['media', 'video'] },
  { key: 'plex', title: 'Plex', slug: 'plex', keywords: ['media', 'video'] },
  { key: 'emby', title: 'Emby', slug: 'emby', keywords: ['media', 'video'] },
  { key: 'alist', title: 'AList', slug: 'alist', keywords: ['drive', 'storage'] },
  { key: 'qbittorrent', title: 'qBittorrent', slug: 'qbittorrent', keywords: ['download', 'bt'] },
  { key: 'transmission', title: 'Transmission', slug: 'transmission', keywords: ['download', 'bt'] },
  { key: 'wordpress', title: 'WordPress', slug: 'wordpress', keywords: ['blog', 'site'] },
  { key: 'bilibili', title: 'Bilibili', slug: 'bilibili', keywords: ['video', 'media'] },
  { key: 'youtube', title: 'YouTube', slug: 'youtube', keywords: ['video', 'media'] },
  { key: 'netflix', title: 'Netflix', slug: 'netflix', keywords: ['video', 'media'] },
  { key: 'telegram', title: 'Telegram', slug: 'telegram', keywords: ['chat', 'message'] },
  { key: 'discord', title: 'Discord', slug: 'discord', keywords: ['chat', 'community'] },
  { key: 'steam', title: 'Steam', slug: 'steam', keywords: ['game'] },
  { key: 'openwrt', title: 'OpenWrt', slug: 'openwrt', keywords: ['router', 'network'] },
  { key: 'tailscale', title: 'Tailscale', slug: 'tailscale', keywords: ['network', 'vpn'] }
]
