// 弹出页面JavaScript
const COPY_HISTORY_KEY = 'copyHistory';

class PopupManager {
    constructor() {
        this.historyList = document.getElementById('historyList');
        this.searchInput = document.getElementById('searchInput');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.favoriteFilterBtn = document.getElementById('favoriteFilterBtn');
        this.clearAllBtn = document.getElementById('clearAllBtn');
        this.historyData = [];
        this.showOnlyFavorites = false;

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

        // 收藏筛选按钮
        this.favoriteFilterBtn.addEventListener('click', () => {
            this.showOnlyFavorites = !this.showOnlyFavorites;
            this.favoriteFilterBtn.classList.toggle('active', this.showOnlyFavorites);
            this.filterHistory();
        });

        // 清空所有按钮
        this.clearAllBtn.addEventListener('click', () => this.clearAllHistory());
    }

    async loadHistory() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'GET_CLIPBOARD_HISTORY' }, (response) => {
                if (response && response.history) {
                    this.historyData = response.history;
                } else {
                    this.historyData = [];
                }
                resolve();
            });
        });
    }

    renderHistory(filteredData = null) {
        const data = filteredData || this.historyData;

        if (data.length === 0) {
            const emptyMsg = this.showOnlyFavorites ? '暂无收藏记录' : '暂无复制记录';
            this.historyList.innerHTML = `<div class="empty-state">${emptyMsg}</div>`;
            return;
        }

        this.historyList.innerHTML = data.map((item, index) => {
            // 找出原始索引（用于操作）
            const originalIndex = this.historyData.indexOf(item);

            return `
                <div class="history-item ${item.favorite ? 'favorite' : ''}">
                    ${item.favorite ? '<span class="favorite-badge">★ 收藏</span>' : ''}
                    <div class="history-text">${this.escapeHtml(item.text)}</div>
                    <div class="history-meta">
                        <span class="source-tag">${this.formatSource(item.source)}</span>
                        <span class="time-tag">${this.formatTime(item.timestamp)}</span>
                    </div>
                    <div class="buttons">
                        <button class="copy-btn" data-action="copy" data-index="${originalIndex}">📋 复制</button>
                        <button class="favorite-btn" data-action="favorite" data-index="${originalIndex}">
                            ${item.favorite ? '★ 已收藏' : '☆ 收藏'}
                        </button>
                        <button class="delete-btn" data-action="delete" data-index="${originalIndex}">🗑️ 删除</button>
                    </div>
                </div>
            `;
        }).join('');

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
        let filtered = this.historyData;

        // 先按收藏筛选
        if (this.showOnlyFavorites) {
            filtered = filtered.filter(item => item.favorite);
        }

        // 再按搜索词筛选
        if (searchTerm) {
            filtered = filtered.filter(item =>
                item.text.toLowerCase().includes(searchTerm) ||
                (item.source && item.source.toLowerCase().includes(searchTerm))
            );
        }

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
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;

        return date.toLocaleString('zh-CN', {
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
            this.showNotification('✓ 已复制到剪贴板');
        } catch (error) {
            console.error('复制失败:', error);
            this.showNotification('✗ 复制失败', 'error');
        }
    }

    async deleteItem(index) {
        if (confirm('确定要删除这条记录吗？')) {
            chrome.runtime.sendMessage({ type: 'DELETE_ITEM', index: index }, async (response) => {
                if (response && response.status === 'success') {
                    await this.loadHistory();
                    this.filterHistory();
                    this.showNotification('✓ 记录已删除');
                } else {
                    this.showNotification('✗ 删除失败', 'error');
                }
            });
        }
    }

    async toggleFavorite(index) {
        chrome.runtime.sendMessage({ type: 'TOGGLE_FAVORITE', index: index }, async (response) => {
            if (response && response.status === 'success') {
                await this.loadHistory();
                this.filterHistory();
                const isFavorite = this.historyData[index].favorite;
                this.showNotification(isFavorite ? '★ 已收藏' : '☆ 已取消收藏');
            } else {
                this.showNotification('✗ 操作失败', 'error');
            }
        });
    }

    async clearAllHistory() {
        if (confirm('确定要清空所有历史记录吗？此操作不可恢复！')) {
            chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' }, async (response) => {
                if (response && response.status === 'success') {
                    await this.loadHistory();
                    this.filterHistory();
                    this.showNotification('✓ 已清空所有记录');
                    // 取消收藏筛选状态
                    this.showOnlyFavorites = false;
                    this.favoriteFilterBtn.classList.remove('active');
                } else {
                    this.showNotification('✗ 清空失败', 'error');
                }
            });
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 16px;
            right: 16px;
            background: ${type === 'success' ? 'linear-gradient(135deg, #34a853 0%, #0d8043 100%)' : 'linear-gradient(135deg, #ea4335 0%, #c5221f 100%)'};
            color: white;
            padding: 12px 20px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            opacity: 0;
            transform: translateX(100px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 10);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 2000);
    }
}

// 初始化
function initializePopup() {
    try {
        window.popupManager = new PopupManager();
    } catch (error) {
        console.error('初始化PopupManager失败:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePopup);
} else {
    initializePopup();
}