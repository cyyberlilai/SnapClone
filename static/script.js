document.addEventListener('DOMContentLoaded', () => {
    // --- 1. THEME & LANGUAGE LOGIC ---
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeIcon = document.getElementById('themeIcon');
    const langToggleBtn = document.getElementById('langToggleBtn');
    
    let currentTheme = localStorage.getItem('snapclone_theme') || 'light';
    let currentLang = localStorage.getItem('snapclone_lang') || 'zh';

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark-mode');
            if (themeIcon) themeIcon.textContent = '🌙';
        } else {
            document.documentElement.classList.remove('dark-mode');
            if (themeIcon) themeIcon.textContent = '☀️';
        }
    }

    applyTheme(currentTheme);
    const langBoxPrimary = document.getElementById('langBoxPrimary');
    const langBoxSecondary = document.getElementById('langBoxSecondary');

    function applyLanguage(lang) {
        window.setLanguage(lang);
        if (lang === 'zh') {
            langBoxPrimary.textContent = '中';
            langBoxSecondary.textContent = 'En';
        } else {
            langBoxPrimary.textContent = 'En';
            langBoxSecondary.textContent = '中';
        }
    }

    applyLanguage(currentLang);

    langToggleBtn.addEventListener('click', () => {
        currentLang = (currentLang === 'zh') ? 'en' : 'zh';
        localStorage.setItem('snapclone_lang', currentLang);
        applyLanguage(currentLang);
    });

    themeToggleBtn.addEventListener('click', () => {
        currentTheme = (currentTheme === 'light') ? 'dark' : 'light';
        localStorage.setItem('snapclone_theme', currentTheme);
        applyTheme(currentTheme);
    });

    // --- 2. COMMON UTILS ---
    function showError(msg, elId = 'error') {
        const el = document.getElementById(elId);
        const iconSvg = `
            <svg viewBox="0 0 24 24" style="width: 1.2rem; height: 1.2rem; flex-shrink: 0;" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="#ef4444"/>
                <text x="12" y="18" fill="white" font-family="Georgia, serif" font-weight="900" font-style="italic" font-size="16" text-anchor="middle">i</text>
            </svg>
        `;
        el.innerHTML = `${iconSvg} <span>${msg}</span>`;
        el.classList.remove('hidden');
    }

    async function triggerDownload(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    // --- 3. SINGLE LINK EXTRACTION ---
    const urlInput = document.getElementById('urlInput');
    const extractBtn = document.getElementById('extractBtn');
    const loading = document.getElementById('loading');
    const resultDiv = document.getElementById('result');
    const thumbnail = document.getElementById('thumbnail');
    const mediaTitle = document.getElementById('mediaTitle');
    const dlVideoBtn = document.getElementById('dlVideoBtn');
    const dlThumbnailBtn = document.getElementById('dlThumbnailBtn');

    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            extractBtn.click();
        }
    });

    extractBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) return showError(window.t('errInvalidUrl'));

        document.getElementById('error').classList.add('hidden');
        resultDiv.classList.add('hidden');
        loading.classList.remove('hidden');
        extractBtn.disabled = true;

        try {
            const resp = await fetch('/api/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await resp.json();

            if (data.success) {
                mediaTitle.textContent = data.title;
                if (data.thumbnail) {
                    const proxiedThumb = `/api/proxy-image?url=${encodeURIComponent(data.thumbnail)}`;
                    const downloadThumb = `/api/proxy-image?url=${encodeURIComponent(data.thumbnail)}&download=true`;
                    thumbnail.src = proxiedThumb;
                    thumbnail.style.display = 'block';
                    dlThumbnailBtn.href = downloadThumb;
                    dlThumbnailBtn.classList.remove('hidden');
                } else {
                    thumbnail.style.display = 'none';
                    dlThumbnailBtn.classList.add('hidden');
                }
                
                thumbnail.onerror = () => thumbnail.style.display = 'none';
                
                dlVideoBtn.href = `/api/download?url=${encodeURIComponent(data.original_url)}`;
                resultDiv.classList.remove('hidden');
            } else {
                showError(window.t('errParseFail') + (data.error || window.t('errUnknown')));
            }
        } catch (e) {
            showError(window.t('errNetworkReq') + e.message);
        } finally {
            loading.classList.add('hidden');
            extractBtn.disabled = false;
        }
    });

    // --- 4. BATCH THUMBNAILS WITH SSE PROGRESS ---
    const batchFileInput = document.getElementById('batchFileInput');
    const fileNameThumb = document.getElementById('fileNameThumb');
    const batchDownloadBtn = document.getElementById('batchDownloadBtn');

    batchFileInput.addEventListener('change', () => {
        fileNameThumb.textContent = batchFileInput.files[0] ? batchFileInput.files[0].name : window.t('noFileChosen');
    });

    const thumbProgressPanel = document.getElementById('batchThumbProgressPanel');
    const thumbProgressFill = document.getElementById('thumbProgressFill');
    const thumbProgressPercentText = document.getElementById('thumbProgressPercentText');
    const thumbProgressStatusText = document.getElementById('thumbProgressStatusText');
    const thumbProgressDetailMsg = document.getElementById('thumbProgressDetailMsg');

    batchDownloadBtn.addEventListener('click', async () => {
        const file = batchFileInput.files[0];
        if (!file) return showError(window.t('errSelectTxt'), 'batchError');
        
        document.getElementById('batchError').classList.add('hidden');
        batchDownloadBtn.disabled = true;
        thumbProgressPanel.classList.remove('hidden');

        const fd = new FormData();
        fd.append('file', file);

        try {
            const resp = await fetch('/api/batch-thumbnails', { method: 'POST', body: fd });
            const data = await resp.json();

            if (data.success) {
                const batchId = data.batch_id;
                const eventSource = new EventSource(`/api/progress/${batchId}`);

                eventSource.onmessage = (event) => {
                    const progress = JSON.parse(event.data);
                    
                    if (progress.status === 'downloading' || progress.status === 'completed') {
                        const percent = progress.percent || 0;
                        thumbProgressFill.style.width = `${percent}%`;
                        thumbProgressPercentText.textContent = `${Math.round(percent)}%`;
                        
                        // Dynamic Translation for Status
                        const statusKey = 'status' + progress.status.charAt(0).toUpperCase() + progress.status.slice(1);
                        thumbProgressStatusText.textContent = window.t(statusKey);
                        
                        if (progress.status === 'downloading' && progress.current_item) {
                            thumbProgressDetailMsg.textContent = window.t('msgFetchingThumb')
                                .replace('{curr}', progress.current_item)
                                .replace('{total}', progress.total);
                        } else if (progress.status === 'zipping') {
                            thumbProgressDetailMsg.textContent = window.t('msgZipping');
                        } else {
                            thumbProgressDetailMsg.textContent = progress.msg;
                        }
                    }

                    if (progress.status === 'completed') {
                        eventSource.close();
                        batchDownloadBtn.disabled = false;
                        thumbProgressDetailMsg.textContent = window.t('msgAllThumbsFinished');
                        if (progress.zip_url) {
                            triggerDownload(progress.zip_url, 'thumbnails_batch.zip');
                        }
                    }

                    if (progress.status === 'error') {
                        eventSource.close();
                        showError(progress.msg, 'batchError');
                        batchDownloadBtn.disabled = false;
                    }
                };

                eventSource.onerror = () => {
                    eventSource.close();
                    batchDownloadBtn.disabled = false;
                };
            } else {
                showError(data.error, 'batchError');
                batchDownloadBtn.disabled = false;
            }
        } catch (e) {
            showError(e.message, 'batchError');
            batchDownloadBtn.disabled = false;
        }
    });

    // --- 5. BATCH VIDEOS WITH SSE PROGRESS ---
    const batchVideoFileInput = document.getElementById('batchVideoFileInput');
    const fileNameVideo = document.getElementById('fileNameVideo');
    const batchVideoDownloadBtn = document.getElementById('batchVideoDownloadBtn');

    batchVideoFileInput.addEventListener('change', () => {
        fileNameVideo.textContent = batchVideoFileInput.files[0] ? batchVideoFileInput.files[0].name : window.t('noFileChosen');
    });

    const progressPanel = document.getElementById('batchVideoProgressPanel');
    const progressFill = document.getElementById('progressFill');
    const progressPercentText = document.getElementById('progressPercentText');
    const progressStatusText = document.getElementById('progressStatusText');
    const progressSpeedText = document.getElementById('progressSpeedText');
    const progressETAText = document.getElementById('progressETAText');
    const progressDetailMsg = document.getElementById('progressDetailMsg');

    batchVideoDownloadBtn.addEventListener('click', async () => {
        const file = batchVideoFileInput.files[0];
        if (!file) return showError(window.t('errSelectTxt'), 'batchVideoError');

        document.getElementById('batchVideoError').classList.add('hidden');
        batchVideoDownloadBtn.disabled = true;
        progressPanel.classList.remove('hidden');

        const fd = new FormData();
        fd.append('file', file);

        try {
            const resp = await fetch('/api/batch-videos', { method: 'POST', body: fd });
            const data = await resp.json();

            if (data.success) {
                const batchId = data.batch_id;
                // Start listening to SSE
                const eventSource = new EventSource(`/api/progress/${batchId}`);

                eventSource.onmessage = (event) => {
                    const progress = JSON.parse(event.data);
                    
                    if (progress.status === 'preparing' || progress.status === 'downloading' || progress.status === 'zipping' || progress.status === 'completed') {
                        const percent = progress.percent || 0;
                        progressFill.style.width = `${percent}%`;
                        progressPercentText.textContent = `${Math.round(percent)}%`;
                        
                        // Dynamic Translation for Status
                        const statusKey = 'status' + progress.status.charAt(0).toUpperCase() + progress.status.slice(1);
                        progressStatusText.textContent = window.t(statusKey);
                        
                        progressSpeedText.textContent = window.t('labelSpeed') + progress.speed;
                        progressETAText.textContent = window.t('labelETA') + progress.eta;
                        
                        if (progress.status === 'downloading' && progress.current_item) {
                            progressDetailMsg.textContent = window.t('msgDownloadingVideo')
                                .replace('{curr}', progress.current_item)
                                .replace('{total}', progress.total);
                        } else if (progress.status === 'preparing' && progress.current_item) {
                            progressDetailMsg.textContent = window.t('msgProcessingVideo')
                                .replace('{curr}', progress.current_item)
                                .replace('{total}', progress.total);
                        } else if (progress.status === 'zipping') {
                            progressDetailMsg.textContent = window.t('msgZipping');
                        } else {
                            progressDetailMsg.textContent = progress.msg;
                        }
                    }

                    if (progress.status === 'completed') {
                        eventSource.close();
                        batchVideoDownloadBtn.disabled = false;
                        progressDetailMsg.textContent = window.t('msgAllVideosFinished');
                        if (progress.zip_url) {
                            triggerDownload(progress.zip_url, 'videos_batch.zip');
                        }
                    }

                    if (progress.status === 'error') {
                        eventSource.close();
                        showError(progress.msg, 'batchVideoError');
                        batchVideoDownloadBtn.disabled = false;
                    }
                };

                eventSource.onerror = () => {
                    eventSource.close();
                    batchVideoDownloadBtn.disabled = false;
                };
            } else {
                showError(data.error, 'batchVideoError');
                batchVideoDownloadBtn.disabled = false;
            }
        } catch (e) {
            showError(e.message, 'batchVideoError');
            batchVideoDownloadBtn.disabled = false;
        }
    });
});