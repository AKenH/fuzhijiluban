// 设置页面JavaScript
class OptionsManager {
    constructor() {
        this.settings = {
            savePath: null,
            maxHistoryItems: 1000,
            autoSave: true,
            buttonDelay: 0,
            showNotification: true,
            excludeSensitive: true,
            autoClean: true
        };

        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.updateUI();
    }

    setupEventListeners() {
        // 安全地添加事件监听器，只在元素存在时添加
        const addListener = (id, event, handler) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
            }
        };

        // 设置保存
        addListener('saveSettingsBtn', 'click', () => this.saveSettings());
        addListener('resetSettingsBtn', 'click', () => this.resetSettings());

        // 文件夹选择
        addListener('chooseFolderBtn', 'click', () => this.chooseFolder());

        // 基础设置
        addListener('maxHistoryItems', 'change', (e) => {
            this.settings.maxHistoryItems = parseInt(e.target.value);
        });
        addListener('autoSave', 'change', (e) => {
            this.settings.autoSave = e.target.checked;
        });

        // 界面设置
        addListener('showNotification', 'change', (e) => {
            this.settings.showNotification = e.target.checked;
        });

        // 数据管理（这些元素在简化版HTML中可能不存在）
        addListener('exportBtn', 'click', () => this.exportHistory());
        addListener('importBtn', 'click', () => this.importHistory());
        addListener('importFile', 'change', (e) => this.handleImportFile(e));
        addListener('clearBtn', 'click', () => this.clearHistory());

        // 其他设置（这些元素在简化版HTML中可能不存在）
        addListener('buttonDelay', 'change', (e) => {
            this.settings.buttonDelay = parseInt(e.target.value);
        });
        addListener('excludeSensitive', 'change', (e) => {
            this.settings.excludeSensitive = e.target.checked;
        });
        addListener('autoClean', 'change', (e) => {
            this.settings.autoClean = e.target.checked;
        });
        addListener('refreshStats', 'click', () => this.updateStatistics());
    }

    async loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['settings'], (result) => {
                if (result.settings) {
                    this.settings = { ...this.settings, ...result.settings };
                }
                resolve();
            });
        });
    }

    async saveSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.set({ settings: this.settings }, () => {
                this.showStatus('设置已保存', true);
                setTimeout(() => this.hideStatus(), 2000);
                resolve();
            });
        });
    }

    async chooseFolder() {
        // 在浏览器扩展中，文件系统访问API有限制
        // 使用输入框让用户手动指定路径，或者使用download API
        try {
            const path = prompt('请输入保存文件夹路径（例如：C:\\Downloads 或 /Users/username/Downloads）：',
                               this.settings.savePath || '');

            if (path !== null) {
                this.settings.savePath = path.trim();
                this.updateUI();
                this.showStatus('保存路径已更新', true);
            }
        } catch (error) {
            console.error('设置保存路径失败:', error);
            this.showStatus('设置保存路径失败', false);
        }
    }

    updateUI() {
        // 安全地更新元素值，只在元素存在时更新
        const updateElement = (id, property, value) => {
            const element = document.getElementById(id);
            if (element) {
                element[property] = value;
            }
        };

        updateElement('maxHistoryItems', 'value', this.settings.maxHistoryItems);
        updateElement('autoSave', 'checked', this.settings.autoSave);
        updateElement('buttonDelay', 'value', this.settings.buttonDelay);
        updateElement('showNotification', 'checked', this.settings.showNotification);
        updateElement('excludeSensitive', 'checked', this.settings.excludeSensitive);
        updateElement('autoClean', 'checked', this.settings.autoClean);

        // 更新保存路径显示
        const savePathElement = document.getElementById('savePath');
        if (savePathElement) {
            savePathElement.textContent = this.settings.savePath || '未选择文件夹';
        }

        // 更新统计信息
        this.updateStatistics();
    }

    async updateStatistics() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['copyHistory'], (result) => {
                const history = result.copyHistory || [];
                const totalCopies = history.length;
                const favoriteCount = history.filter(item => item.favorite).length;

                // 统计最常用的来源
                const sourceCounts = {};
                history.forEach(item => {
                    const source = item.source || '未知';
                    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
                });

                const topSource = Object.keys(sourceCounts).length > 0
                    ? Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0][0]
                    : '-';

                // 安全地更新统计元素，只在元素存在时更新
                const updateStats = (id, value) => {
                    const element = document.getElementById(id);
                    if (element) {
                        element.textContent = value;
                    }
                };

                updateStats('totalCopies', totalCopies);
                updateStats('favoriteCount', favoriteCount);
                updateStats('topSource', topSource);

                resolve();
            });
        });
    }

    async exportHistory() {
        try {
            const result = await this.getCopyHistory();
            const dataStr = JSON.stringify(result, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `copy-history-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();

            this.showStatus('历史记录已导出', true);
        } catch (error) {
            console.error('导出失败:', error);
            this.showStatus('导出失败', false);
        }
    }

    async importHistory() {
        const importFileElement = document.getElementById('importFile');
        if (importFileElement) {
            importFileElement.click();
        }
    }

    async handleImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!Array.isArray(data)) {
                throw new Error('无效的数据格式');
            }

            if (confirm(`确定要导入 ${data.length} 条记录吗？这将覆盖现有记录。`)) {
                await this.saveCopyHistory(data);
                this.updateStatistics();
                this.showStatus(`成功导入 ${data.length} 条记录`, true);
            }
        } catch (error) {
            console.error('导入失败:', error);
            this.showStatus('导入失败：' + error.message, false);
        }

        // 清空文件输入
        event.target.value = '';
    }

    async clearHistory() {
        if (confirm('确定要清空所有复制记录吗？此操作无法撤销！')) {
            try {
                await this.saveCopyHistory([]);
                this.updateStatistics();
                this.showStatus('所有记录已清空', true);
            } catch (error) {
                console.error('清空失败:', error);
                this.showStatus('清空失败', false);
            }
        }
    }

    async resetSettings() {
        if (confirm('确定要重置所有设置为默认值吗？')) {
            this.settings = {
                savePath: null,
                maxHistoryItems: 1000,
                autoSave: true,
                buttonDelay: 0,
                showNotification: true,
                excludeSensitive: true,
                autoClean: true
            };

            this.updateUI();
            await this.saveSettings();
            this.showStatus('设置已重置为默认值', true);
        }
    }

    getCopyHistory() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['copyHistory'], (result) => {
                resolve(result.copyHistory || []);
            });
        });
    }

    saveCopyHistory(history) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ copyHistory: history }, resolve);
        });
    }

    showStatus(message, isSuccess = true) {
        const statusElement = document.getElementById('saveStatus');
        statusElement.textContent = message;
        statusElement.className = `status-message ${isSuccess ? 'success' : 'error'} show`;

        // 自动隐藏状态消息
        setTimeout(() => {
            this.hideStatus();
        }, 3000);
    }

    hideStatus() {
        const statusElement = document.getElementById('saveStatus');
        statusElement.classList.remove('show');
    }
}

// 初始化设置管理器
const optionsManager = new OptionsManager();