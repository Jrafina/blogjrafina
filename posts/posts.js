// ==========================================
// 博客文章清单 - 添加新文章只需在此数组添加条目
// ==========================================

const POSTS = [
  {
    file: "齐次变换矩阵.md",
    title: "齐次变换矩阵",
    date: "2026-09-29",
    category: "learning",
    desc: "齐次变换矩阵",
    keywords: ["矩阵", "变换"],
    cover: "https://img.1795857.xyz/file/博客/齐次变换矩阵/齐次变换矩阵.png"
  },
  {
    file: "服务器虚拟环境激活并添加system进程守护.md",
    title: "服务器虚拟环境激活并添加system进程守护",
    date: "2026-08-10",
    category: "tutorials",
    desc: "服务器虚拟环境激活并添加system进程守护",
    keywords: ["linux","python","虚拟环境","systemd"],
    cover: "https://img.1795857.xyz/file/博客/服务器虚拟环境激活并添加system进程守护.png"
  },
  {
    file: "linux基础学习.md",
    title: "linux基础学习",
    date: "2026-08-10",
    category: "learning",
    desc: "linux基础学习",
    keywords: ["linux"],
    cover: "https://img.1795857.xyz/file/博客/linux基础学习.png"
  },
  {
    file: "本地上传项目到github.md",
    title: "本地上传项目到github",
    date: "2026-08-04",
    category: "tutorials",
    desc: "本地上传项目到github",
    keywords: ["github", "上传", "项目"],
    cover: "https://img.1795857.xyz/file/博客/本地项目推送_GitHub_教程.png"
  },
  {
    file: "在飞牛上面解锁挂在 veracrypt 加密盘及卸载.md",
    title: "在飞牛上面解锁挂在 veracrypt 加密盘及卸载",
    date: "2026-08-04",
    category: "tutorials",
    desc: "在飞牛上面解锁挂在 veracrypt 加密盘及卸载",
    keywords: ["飞牛", "veracrypt", "加密盘", "卸载"],
    cover: "https://img.1795857.xyz/file/博客/在飞牛上面解锁挂在_veracrypt_加密盘及卸载.png"
  },
  {
    file: "github通过ssh连接本地windows电脑.md",
    title: "github通过ssh连接本地windows电脑",
    date: "2026-07-28",
    category: "tutorials",
    desc: "github通过ssh密钥连接解决https连接问题",
    keywords: ["github","ssh"],
    cover: "https://img.1795857.xyz/file/博客/GitHub_通过_SSH_连接本地_Windows_电脑.png"
  },
  {
    file: "重积分演示.md",
    title: "重积分演示",
    date: "2026-07-25",
    category: "tutorials",
    desc: "",
    keywords: [""],
    cover: "https://img.1795857.xyz/file/博客/重积分演示.png"
  },
  {
    file: "cloudflare部署2fa验证器.md",
    title: "cloudflare部署2fa验证器",
    date: "2026-07-25",
    category: "tutorials",
    desc: "2fa验证器",
    keywords: ["2fa验证器", "cloudflare"],
    cover: "https://img.1795857.xyz/file/博客/cloudflare部署2fa验证器.png"
  },
  {
    file: "概率论与数理统计.html",
    title: "概率论与数理统计",
    date: "2026-05-23",
    category: "learning",
    desc: "概率论与数理统计（速通）",
    keywords: ["概率论", "数理统计", "数学"],
    cover: "https://picsum.photos/seed/probability-stats/800/450"
  },
  {
    file: "2fa验证添加.md",
    title: "2fa验证添加",
    date: "2026-05-23",
    category: "tutorials",
    desc: "可以为前端项目添加一个2fa验证保护",
    keywords: ["Cloudflare Worker", "2FA", "安全"],
    cover: "https://picsum.photos/seed/totp-add/800/450"
  },
  {
    file: "线性代数（速通笔记）.html",
    title: "线性代数（速通笔记）",
    date: "2026-05-20",
    category: "learning",
    desc: "线性代数",
    keywords: ["线性代数", "速通笔记"],
    cover: "https://picsum.photos/seed/linear-algebra/800/450"
  },
  {
    file: "📘 Cloudflare R2 + rclone 配置完全指南（Windows）.md",
    title: "Cloudflare R2 + rclone 配置完全指南",
    date: "2026-05-01",
    category: "tutorials",
    desc: "Cloudflare R2 + rclone 配置完全指南",
    keywords: ["Cloudflare", "R2", "rclone"],
    cover: "https://picsum.photos/seed/r2-rclone/800/450"
  },
  {
    file: "图片代理和防盗链.md",
    title: "图片代理及防盗链",
    date: "2026-05-01",
    category: "tutorials",
    desc: "Cloudflare Worker 代理图片及防盗链",
    keywords: ["Cloudflare", "Worker", "防盗链"],
    cover: "https://picsum.photos/seed/image-proxy/800/450"
  },
  {
    file: "markdown语法学习.md",
    title: "Markdown 语法学习",
    date: "2025-12-05",
    category: "tutorials",
    desc: "简易版 Markdown 的语法总结",
    keywords: ["Markdown", "语法", "教程", "写作"],
    cover: "https://picsum.photos/seed/markdown/800/450"
  }
];
