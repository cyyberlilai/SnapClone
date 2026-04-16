# SnapClone Professional 🚀

**SnapClone** 是一款大气、专业且功能强大的万能多媒体解析下载工具。它不仅拥有极具现代感的“金色麦田”视觉设计，更集成了硬核的音视频解析与自动合并技术，支持全球 1000+ 主流视频与图片平台。

---

## ✨ 核心特性

- **🌍 万能解析：** 支持 YouTube, TikTok, Instagram (Reels), Facebook, Bilibili, RedNote, Twitter/X, Reddit 等超过 1000 个平台的视频、短视频及图片提取。
- **💎 最高清画质：** 自动识别并抓取底层最佳视频流与音频流，在后台自动通过 FFmpeg 完成无损合并，确保输出的是原生最高清 MP4。
- **📊 实时进度系统：** 采用 Server-Sent Events (SSE) 技术，批量下载时可实时在网页上看到每一个任务的下载百分比、网速及预计剩余时间 (ETA)。
- **📦 批量处理能力：** 支持通过上传 `.txt` 链接清单，一键批量打包高清封面图或原视频为 ZIP 压缩包。
- **🎨 顶级 UI/UX 设计：**
  - **品牌配色：** 极具辨识度的琥珀金与炭黑组合，大气专业。
  - **毛玻璃拟态 (Glassmorphism)：** 精致的磨砂透明质感，配合动态背景气泡。
  - **全站汉化 (i18n)：** 完美支持中英文一键切换，并能记忆用户偏好。
  - **深度暗黑模式：** 智能主题切换，为夜间使用提供极佳视觉保护。
- **🚀 秒级交互：** 自定义即时提示框 (Instant Tooltips) 和极速响应的吸顶式导航栏。

---

## 🛠️ 技术栈

- **后端：** [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **解析引擎：** [yt-dlp](https://github.com/yt-dlp/yt-dlp) (目前业界最强、维护最活跃的开源解析库)
- **音视频处理：** [FFmpeg](https://ffmpeg.org/) (负责音视频无损重封与合并)
- **前端：** Vanilla JS, CSS3 (Glassmorphism), SVG

---

## 📥 快速开始

### 1. 环境要求
- Python 3.8+
- **必须安装 FFmpeg** (用于合并音视频，若不安装则部分平台只能下载无声视频)

### 2. 安装与运行
```bash
# 克隆项目
git clone https://github.com/cyyberlilai/SnapClone.git
cd SnapClone

# 创建并激活虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动服务
uvicorn main:app --port 8000 --reload
```

### 3. 访问
打开浏览器访问 `http://127.0.0.1:8000`。

---

## 💡 常见问题

**Q: 为什么不需要 API Key？**
A: 本工具基于网页解析技术，不调用各平台的付费 API 接口，完全免费且无配额限制。

**Q: 部分平台封面不显示怎么办？**
A: 系统内置了“图像代理”功能，已完美绕过 Instagram、Bilibili 等平台的防盗链限制。

**Q: 发现某些视频解析失败？**
A: 各大平台反爬策略经常更新，只需在终端运行 `pip install -U yt-dlp` 升级核心引擎即可解决 99% 的解析问题。

---

## 📜 免责声明
本工具仅供个人学习与素材备份使用。请尊重原创作者的版权，严禁将下载内容用于任何侵权或非法商业用途。
