// 后台服务工作者脚本
const COPY_HISTORY_KEY = 'copyHistory';
const MAX_HISTORY_ITEMS = 1000;

// 初始化存储
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get([COPY_HISTORY_KEY], (result) => {
        if (!result[COPY_HISTORY_KEY]) {
            chrome.storage.local.set({ [COPY_HISTORY_KEY]: [] });
        }
    });
});

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SAVE_COPY') {
        saveCopyRecord(request);
        sendResponse({ status: 'success' });
    } else if (request.type === 'GET_CLIPBOARD_HISTORY') {
        // 获取复制历史记录
        chrome.storage.local.get([COPY_HISTORY_KEY], (result) => {
            sendResponse({ history: result[COPY_HISTORY_KEY] || [] });
        });
        return true; // 保持消息通道开放
    }
    return true;
});

// 保存复制记录
function saveCopyRecord({ text, source, timestamp }) {
    chrome.storage.local.get([COPY_HISTORY_KEY], (result) => {
        const history = result[COPY_HISTORY_KEY] || [];
        
        // 添加到历史记录开头
        history.unshift({
            text,
            source,
            timestamp,
            favorite: false
        });

        // 限制历史记录数量
        if (history.length > MAX_HISTORY_ITEMS) {
            history.pop();
        }

        chrome.storage.local.set({ [COPY_HISTORY_KEY]: history });
    });
}

// 监听系统剪贴板变化（需要额外权限）
function setupClipboardListener() {
    // 这里需要额外的native host应用来监听系统剪贴板
    // 这部分功能需要额外的native应用配合实现
}

// 设置右键菜单
function setupContextMenu() {
    chrome.contextMenus.create({
        id: 'saveToClipboardHistory',
        title: '保存到复制记录板',
        contexts: ['selection']
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === 'saveToClipboardHistory' && info.selectionText) {
            saveCopyRecord({
                text: info.selectionText,
                source: tab.url,
                timestamp: new Date().toISOString()
            });
        }
    });
}

// 初始化
setupContextMenu();
setupClipboardListener();