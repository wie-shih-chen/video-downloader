/**
 * Video Downloader Logic
 * Handles preview, download, progress polling, and file management.
 */

document.addEventListener('DOMContentLoaded', function () {
    console.log('Downloader JS Loaded');

    const urlInput = document.getElementById('urlInput');
    const previewBtn = document.getElementById('previewBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const videoInfoCard = document.getElementById('videoInfoCard');
    const statusText = document.getElementById('statusText');
    const mainProgress = document.getElementById('mainProgress');
    const speedStat = document.getElementById('speedStat');
    const etaStat = document.getElementById('etaStat');

    let pollInterval = null;

    // --- Format Selection Support (Visual Cards) ---
    // Although mainly CSS driven, we ensure the radio logic works
    const radios = document.querySelectorAll('input[name="format"]');
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            console.log('Selected format:', e.target.value);
        });
    });

    // --- 1. Preview Functionality ---
    previewBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
            showStatus('請輸入網址', 'error');
            return;
        }

        setLoading(true, previewBtn);
        showStatus('正在抓取影片資訊...', 'info');
        videoInfoCard.classList.add('hidden');

        try {
            const response = await fetch('/download/api/info', { // Note the /download prefix
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url })
            });

            const data = await response.json();

            if (data.error) {
                showStatus('錯誤: ' + data.error, 'error');
            } else {
                // Update Video Info Card
                document.getElementById('videoThumb').src = data.thumbnail;
                document.getElementById('videoTitle').textContent = data.title;
                document.getElementById('videoAuthor').textContent = data.uploader;
                document.getElementById('videoDuration').textContent = formatDuration(data.duration);

                videoInfoCard.classList.remove('hidden');
                showStatus('影片資訊獲取成功！請選擇格式並下載。', 'success');
                downloadBtn.disabled = false; // Enable download
            }
        } catch (error) {
            console.error(error);
            showStatus('無法連接伺服器', 'error');
        } finally {
            setLoading(false, previewBtn);
        }
    });

    // --- 2. Start Download (Direct Stream) ---
    downloadBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) return;

        const format = document.querySelector('input[name="format"]:checked').value;
        const subtitles = document.getElementById('subtitles') ? document.getElementById('subtitles').checked : false;

        // Build Stream URL
        const streamUrl = `/download/api/stream?url=${encodeURIComponent(url)}&format=${format}`;

        // UI Feedback
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '⏳ 正在準備串流...';
        showStatus('正在請求伺服器串流傳輸...', 'info');
        mainProgress.style.width = '100%';
        mainProgress.classList.add('striped-animate'); // Assuming CSS has animation

        // Trigger Download
        // We use a temporary iframe or window location to start download without leaving page context if possible, 
        // but window.location is simplest for reliable file save dialog.
        window.location.href = streamUrl;

        // Reset UI after a short delay (since we can't track stream progress easily)
        setTimeout(() => {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '🚀 開始下載';
            showStatus('已啟動下載！請查看瀏覽器下載管理器。', 'success');
        }, 3000);
    });

    // Legacy Polling Code Removed for Stream Mode
    function startPolling() { }


    function resetDownloadBtn() {
        setLoading(false, downloadBtn);
        downloadBtn.innerHTML = '🚀 開始下載';
    }

    // --- 3. Progress Polling ---
    function startPolling() {
        if (pollInterval) clearInterval(pollInterval);

        pollInterval = setInterval(async () => {
            try {
                const response = await fetch('/download/api/tasks'); // Get all tasks
                const tasks = await response.json();

                // Assuming single user single task focus for now, or finding the active one
                // For simplicity, we grab the first 'downloading' or 'processing' task
                // or just the most recent one.
                const activeTask = Object.values(tasks).find(t => t.status === 'downloading' || t.status === 'processing' || t.status === 'started');

                if (activeTask) {
                    updateProgressUI(activeTask);
                } else {
                    // Check if we have a recently finished task?
                    // For now, if no active task, check if we should stop polling
                    const finishedTask = Object.values(tasks).find(t => t.status === 'finished');
                    if (finishedTask && mainProgress.style.width !== '100%') {
                        updateProgressUI(finishedTask);
                        showStatus('下載完成！', 'success');
                        refreshFiles(); // Refresh file list
                        resetDownloadBtn();
                        clearInterval(pollInterval);
                    }
                }
            } catch (e) {
                console.error('Polling error', e);
            }
        }, 1000);
    }

    function updateProgressUI(task) {
        if (task.progress) {
            // task.progress is usually a string like "45.5%" or number
            let pct = parseFloat(task.progress);
            if (isNaN(pct)) pct = 0;
            mainProgress.style.width = pct + '%';

            // Speed and ETA
            if (task.speed) speedStat.textContent = '速度: ' + task.speed;
            if (task.eta) etaStat.textContent = '剩餘: ' + task.eta;
        }

        if (task.status === 'finished') {
            mainProgress.style.width = '100%';
            statusText.textContent = '下載完成 ✅';

            // Auto-trigger browser download
            if (task.filename) {
                showStatus('正在傳送檔案至您的電腦...', 'success');
                const link = document.createElement('a');
                link.href = `/download/api/files/download/${encodeURIComponent(task.filename)}`;
                link.download = task.filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } else if (task.status === 'error') {
            mainProgress.style.background = '#e53e3e';
            statusText.textContent = '發生錯誤 ❌';
            resetDownloadBtn();
            clearInterval(pollInterval);
        } else {
            statusText.textContent = `下載中... (${task.progress || '0%'})`;
        }
    }


    if (refreshFilesBtn) {
        // refreshFilesBtn.addEventListener('click', refreshFiles); // Removed as refreshFiles is gone
    }

    // Initial Load
    // refreshFiles(); // Removed as refreshFiles is gone

    // --- Helpers ---
    function showStatus(msg, type) {
        statusText.textContent = msg;
        statusText.className = 'status-text ' + type;
    }

    function setLoading(isLoading, btn) {
        if (isLoading) {
            btn.disabled = true;
            btn.style.opacity = '0.7';
        } else {
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    }

    function formatDuration(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
});
