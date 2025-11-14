// 弹出页面JavaScript
const COPY_HISTORY_KEY = 'copyHistory';

class PopupManager {
    constructor() {
        this.historyList = document.getElementById('historyList');
        this.searchInput = document.getElementById('searchInput');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.historyData = [];
        
        this.init();
    }

    async init() {
        await this.loadHistory();
        this.renderHistory();
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.searchInput.addEventListener('input', () => this.filterHistory());
        this.settingsBtn.addEventListener('click', () => this.openSettings());
    }

    async loadHistory() {
        return new Promise((resolve) => {
            chrome.storage.local.get([COPY_HISTORY_KEY], (result) => {
                this.historyData = result[COPY_HISTORY_KEY] || [];
                resolve();
            });
        });
    }

    renderHistory(filteredData = null) {
        const data = filteredData || this.historyData;
        
        if (data.length === 0) {
            this.historyList.innerHTML = '<div class="empty-state">暂无复制记录</div>';
            return;
        }
        this.historyList.innerHTML = data.map((item, index) => `
            <div class="history-item ${item.favorite ? 'favorite' : ''}">
                ${item.favorite ? '<div class="favorite-badge">★</div>' : ''}
                <div class="history-text">${this.escapeHtml(item.text)}</div>
                <div class="history-meta">
                    <span class="source-tag">${this.formatSource(item.source)}</span>
                    <span class="time-tag">${this.formatTime(item.timestamp)}</span>
                </div>
                <div class="buttons">
                    <button class="copy-btn" onclick="copyToClipboard(${index})">📋 复制</button>
                    <button class="delete-btn" onclick="deleteItem(${index})">🗑️ 删除</button>
                    <button class="favorite-btn" onclick="toggleFavorite(${index})">
                        ${item.favorite ? '★' : '☆'} ${item.favorite ? '已收藏' : '收藏'}
                    </button>
                </div>
            </div>
        `).join('');

        // 添加事件监听器到按钮
        this.historyList.querySelectorAll('button[data-action]').forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const index = parseInt(e.target.dataset.index);
                this.handleAction(action, index);
            });
        });
    }

    filterHistory() {
        const searchTerm = this.searchInput.value.toLowerCase().trim();
        
        if (!searchTerm) {
            this.renderHistory();
            return;
        }

        const filtered = this.historyData.filter(item =>
            item.text.toLowerCase().includes(searchTerm) ||
            item.source.toLowerCase().includes(searchTerm)
        );
        
        this.renderHistory(filtered);
    }

    formatSource(source) {
        if (!source) return '未知来源';
        try {
            const url = new URL(source);
            return url.hostname;
        } catch {
            return source.length > 20 ? source.substring(0, 20) + '...' : source;
        }
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    openSettings() {
        // 直接在新标签页打开设置页面
        chrome.tabs.create({ url: 'options.html' });
    }

    async handleAction(action, index) {
        const item = this.historyData[index];
        if (!item) return;

        switch (action) {
            case 'copy':
                await this.copyToClipboard(item);
                break;
            case 'delete':
                await this.deleteItem(index);
                break;
            case 'favorite':
                await this.toggleFavorite(index);
                break;
        }
    }

    async copyToClipboard(item) {
        try {
            await navigator.clipboard.writeText(item.text);
            this.showNotification('已复制到剪贴板');
        } catch (error) {
            console.error('复制失败:', error);
            this.showNotification('复制失败', 'error');
        }
    }

    async deleteItem(index) {
        if (confirm('确定要删除这条记录吗？')) {
            this.historyData.splice(index, 1);
            await this.saveHistory();
            this.renderHistory();
            this.showNotification('记录已删除');
        }
    }

    async toggleFavorite(index) {
        this.historyData[index].favorite = !this.historyData[index].favorite;
        await this.saveHistory();
        this.renderHistory();
        this.showNotification(this.historyData[index].favorite ? '已收藏' : '已取消收藏');
    }
    showNotification(message, type = 'success') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #333333;
            color: white;
            padding: 8px 12px;
            border-radius: 3px;
            font-size: 12px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        document.body.appendChild(notification);

        // 1.5秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 1500);
    }

    async saveHistory() {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [COPY_HISTORY_KEY]: this.historyData }, resolve);
        });
    }
}

// 全局函数供按钮使用
async function copyToClipboard(index) {
    await popupManager.copyToClipboard(popupManager.historyData[index]);
}

async function deleteItem(index) {
    await popupManager.deleteItem(index);
}

async function toggleFavorite(index) {
    await popupManager.toggleFavorite(index);
}

// 初始化
const popupManager = new PopupManager();