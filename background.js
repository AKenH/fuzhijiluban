// 后台服务工作者脚本
const COPY_HISTORY_KEY = 'copyHistory';
const MAX_HISTORY_ITEMS = 1000;

// 历史记录管理器
const HistoryManager = {
    // 获取历史记录
    async getHistory() {
        return new Promise((resolve) => {
            chrome.storage.local.get([COPY_HISTORY_KEY], (result) => {
                resolve(result[COPY_HISTORY_KEY] || []);
            });
        });
    },

    // 保存历史记录
    async saveHistory(history) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [COPY_HISTORY_KEY]: history }, resolve);
        });
    },

    // 添加记录
    async addRecord({ text, source, timestamp, type = 'text' }) {
        const history = await this.getHistory();

        // 检查重复
        if (history.length > 0 && history[0].text === text) {
            // 更新时间戳
            history[0].timestamp = timestamp;
            await this.saveHistory(history);
            return;
        }

        const record = {
            text,
            source,
            timestamp,
            type,
            favorite: false
        };

        history.unshift(record);

        if (history.length > MAX_HISTORY_ITEMS) {
            history.pop();
        }

        await this.saveHistory(history);
    },

    // 删除记录
    async deleteRecord(index) {
        const history = await this.getHistory();
        if (index >= 0 && index < history.length) {
            history.splice(index, 1);
            await this.saveHistory(history);
        }
    },

    // 切换收藏状态
    async toggleFavorite(index) {
        const history = await this.getHistory();
        if (index >= 0 && index < history.length) {
            history[index].favorite = !history[index].favorite;
            await this.saveHistory(history);
        }
    },

    // 清空历史
    async clearHistory() {
        await this.saveHistory([]);
    }
};

// 初始化存储
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get([COPY_HISTORY_KEY], (result) => {
        if (!result[COPY_HISTORY_KEY]) {
            chrome.storage.local.set({ [COPY_HISTORY_KEY]: [] });
        }
    });
});

// 消息监听器
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(request).then(sendResponse);
    return true; // 保持消息通道开放以进行异步响应
});

async function handleMessage(request) {
    try {
        switch (request.type) {
            case 'SAVE_COPY':
                await HistoryManager.addRecord(request.data);
                return { status: 'success' };

            case 'GET_CLIPBOARD_HISTORY':
                const history = await HistoryManager.getHistory();
                return { history };

            case 'DELETE_ITEM':
                await HistoryManager.deleteRecord(request.index);
                return { status: 'success' };

            case 'TOGGLE_FAVORITE':
                await HistoryManager.toggleFavorite(request.index);
                return { status: 'success' };

            case 'CLEAR_HISTORY':
                await HistoryManager.clearHistory();
                return { status: 'success' };

            default:
                return { status: 'error', error: 'Unknown message type' };
        }
    } catch (error) {
        console.error('Error handling message:', error);
        return { status: 'error', error: error.message };
    }
}