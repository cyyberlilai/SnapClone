const translations = {
    zh: {
        title: "SnapClone",
        subtitle: "支持 1000+ 平台的万能无水印视频/图片解析下载工具",
        singleExtractTitle: "单链接解析",
        inputPlaceholder: "在此粘贴视频、图片或网页链接 (例如: YouTube, TikTok...)",
        extractBtn: "解析链接",
        parsingLoading: "正在解析资源，请稍候...",
        previewDownloadBtn: "下载原视频",
        dlThumbnailBtn: "下载封面图片",
        downloadHint: "提示：系统会优先保留站点提供的最高画质原始格式；如果站点将音视频分离提供，则会在后台无损合并后再下载到您的设备。",
        batchThumbTitle: "批量下载封面 (TXT)",
        batchThumbDesc: "上传包含视频链接的 .txt 文件 (每行一个链接)，服务器将自动打包所有封面为 ZIP 文件供您下载。",
        batchThumbBtn: "批量下载封面 ZIP",
        batchThumbLoading: "正在后台批量解析并打包封面，可能需要几分钟，请勿刷新页面...",
        batchVideoTitle: "批量下载原视频 (TXT)",
        batchVideoDesc: "上传包含视频链接的 .txt 文件 (每行一个链接)，服务器将在后台逐个下载各站点可获取的最高画质原始视频；如遇分离音视频源，将自动无损合并后再打包为 ZIP 文件。",
        batchVideoBtn: "批量下载视频 ZIP",
        batchVideoLoading: "正在后台逐个下载最高画质视频（文件体积较大）；如果站点提供的是分离音视频源，系统会自动无损合并。此过程可能需要较长时间，请耐心等待，切勿刷新页面...",
        
        // File Input
        chooseFile: "选择文件",
        noFileChosen: "未选择文件",

        // Progress translations
        statusPreparing: "准备中...",
        statusDownloading: "正在下载...",
        statusZipping: "正在打包 ZIP...",
        statusCompleted: "已完成",
        statusError: "发生错误",
        labelSpeed: "速度: ",
        labelETA: "剩余时间: ",
        msgZipping: "正在打包 ZIP 文件，请稍候...",
        msgFetchingThumb: "正在提取第 {curr}/{total} 张封面...",
        msgProcessingVideo: "正在准备第 {curr}/{total} 个视频...",
        msgDownloadingVideo: "正在下载第 {curr}/{total} 个视频...",
        msgAllThumbsFinished: "所有封面提取完成！",
        msgAllVideosFinished: "所有视频下载完成！",

        // Theme translations
        themeLight: "浅色模式",
        themeDark: "深色模式",
        toggleTheme: "切换主题",
        switchLanguage: "切换语言",

        // Error messages
        errInvalidUrl: "请输入有效的链接",
        errParseFail: "解析失败: ",
        errNetworkReq: "网络请求失败: ",
        errUnknown: "未知错误",
        errSelectTxt: "请先选择一个包含链接的 .txt 文件",
        errBatchFail: "批量下载失败: ",
        errServerResp: "服务器响应错误: "
    },
    en: {
        title: "SnapClone",
        subtitle: "Universal watermark-free video/image downloader supporting 1000+ platforms",
        singleExtractTitle: "Single Link Extraction",
        inputPlaceholder: "Paste video, image, or web link here (e.g., YouTube, TikTok...)",
        extractBtn: "Extract Link",
        parsingLoading: "Parsing resources, please wait...",
        previewDownloadBtn: "Download Video",
        dlThumbnailBtn: "Download Thumbnail",
        downloadHint: "Hint: The downloader keeps the highest-quality source format whenever the site provides one directly. If the site separates video and audio streams, they will be merged losslessly before download.",
        batchThumbTitle: "Batch Download Thumbnails (TXT)",
        batchThumbDesc: "Upload a .txt file containing video links (one link per line), and the server will automatically pack all thumbnails into a ZIP file for you to download.",
        batchThumbBtn: "Batch Download Thumbnails ZIP",
        batchThumbLoading: "Parsing and packing thumbnails in the background, this may take a few minutes, please do not refresh the page...",
        batchVideoTitle: "Batch Download Original Videos (TXT)",
        batchVideoDesc: "Upload a .txt file containing video links (one per line). The server will download the highest-quality source video available for each site and merge streams losslessly only when the site provides video/audio separately before packing everything into a ZIP file.",
        batchVideoBtn: "Batch Download Videos ZIP",
        batchVideoLoading: "Downloading the highest-quality videos in the background (large files). When a site provides separate video/audio streams, they will be merged losslessly. This may take a long time depending on network speed and video quantity. Please do not refresh the page...",
        
        // File Input
        chooseFile: "Choose File",
        noFileChosen: "No file chosen",

        // Progress translations
        statusPreparing: "Preparing...",
        statusDownloading: "Downloading...",
        statusZipping: "Zipping...",
        statusCompleted: "Completed",
        statusError: "Error",
        labelSpeed: "Speed: ",
        labelETA: "ETA: ",
        msgZipping: "Packing files into ZIP, please wait...",
        msgFetchingThumb: "Fetching thumbnail {curr}/{total}...",
        msgProcessingVideo: "Processing video {curr}/{total}...",
        msgDownloadingVideo: "Downloading video {curr}/{total}...",
        msgAllThumbsFinished: "All thumbnails finished!",
        msgAllVideosFinished: "All videos downloaded!",

        // Theme translations
        themeLight: "Light Mode",
        themeDark: "Dark Mode",
        toggleTheme: "Toggle Theme",
        switchLanguage: "Switch Language",

        // Error messages
        errInvalidUrl: "Please enter a valid link",
        errParseFail: "Extraction failed: ",
        errNetworkReq: "Network request failed: ",
        errUnknown: "Unknown error",
        errSelectTxt: "Please select a .txt file containing links first",
        errBatchFail: "Batch download failed: ",
        errServerResp: "Server response error: "
    }
};

let currentLang = localStorage.getItem('snapclone_lang') || 'zh';

window.setLanguage = function(lang) {
    if (!translations[lang]) lang = 'zh';
    currentLang = lang;
    localStorage.setItem('snapclone_lang', lang);
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) {
            el.innerHTML = translations[lang][key]; // Using innerHTML if there's any HTML formatting inside, or textContent
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[lang][key]) {
            el.placeholder = translations[lang][key];
        }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (translations[lang][key]) {
            el.title = translations[lang][key];
        }
    });

    document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
        const key = el.getAttribute('data-i18n-tooltip');
        if (translations[lang][key]) {
            el.setAttribute('data-tooltip', translations[lang][key]);
        }
    });

    document.documentElement.lang = lang;
}

window.t = function(key) {
    return translations[currentLang][key] || key;
};
