// 复制记录板内容脚本
class CopyRecorder {
    constructor() {
        this.copyButton = null;
        this.selectionText = '';
        this.init();
    }

    // 检查Chrome API是否可用
    isChromeRuntimeAvailable() {
        try {
            return typeof chrome !== 'undefined' &&
                   chrome.runtime &&
                   chrome.runtime.id && // 检查扩展ID是否存在
                   chrome.runtime.sendMessage &&
                   !chrome.runtime.lastError;
        } catch (error) {
            return false;
        }
    }

    // 安全发送消息到background script
    async sendToBackground(message) {
        try {
            if (this.isChromeRuntimeAvailable()) {
                return new Promise((resolve) => {
                    const timeoutId = setTimeout(() => {
                        console.warn('消息发送超时');
                        resolve({ status: 'timeout', error: '消息发送超时' });
                    }, 3000);

                    chrome.runtime.sendMessage(message, (response) => {
                        clearTimeout(timeoutId);
                        
                        if (chrome.runtime.lastError) {
                            const errorMessage = chrome.runtime.lastError.message;
                            console.warn('Background script通信错误:', errorMessage);
                            
                            // 如果是扩展上下文失效，尝试使用本地存储
                            if (errorMessage.includes('Extension context invalidated')) {
                                this.saveToLocalStorage(message);
                                resolve({ status: 'fallback', error: '使用本地存储备份' });
                            } else {
                                resolve({ status: 'error', error: errorMessage });
                            }
                        } else {
                            resolve(response || { status: 'success' });
                        }
                    });
                });
            } else {
                console.warn('Chrome runtime API不可用，使用本地存储');
                this.saveToLocalStorage(message);
                return { status: 'fallback', error: '使用本地存储备份' };
            }
        } catch (error) {
            console.error('发送消息到background失败:', error);
            // 尝试使用本地存储作为备选方案
            this.saveToLocalStorage(message);
            return { status: 'fallback', error: '使用本地存储备份' };
        }
    }

    // 本地存储备选方案
    saveToLocalStorage(message) {
        try {
            const historyKey = 'copyHistory_backup';
            const existingData = localStorage.getItem(historyKey);
            let history = [];
            
            if (existingData) {
                try {
                    history = JSON.parse(existingData);
                } catch (parseError) {
                    console.warn('解析本地历史记录失败，创建新记录');
                    history = [];
                }
            }
            
            // 添加新记录
            history.unshift({
                text: message.text,
                source: message.source,
                timestamp: message.timestamp,
                favorite: false
            });
            
            // 限制记录数量
            if (history.length > 1000) {
                history = history.slice(0, 1000);
            }
            
            localStorage.setItem(historyKey, JSON.stringify(history));
            console.log('使用本地存储保存复制记录成功');
        } catch (localError) {
            console.error('本地存储也失败:', localError);
        }
    }

    init() {
        // 监听鼠标抬起事件，检测文字选择
        document.addEventListener('mouseup', this.handleSelection.bind(this));
        
        // 只在点击非按钮区域时隐藏按钮
        document.addEventListener('mousedown', (e) => {
            if (!this.copyButton || !this.copyButton.contains(e.target)) {
                this.hideButton();
            }
        });
    }

    handleSelection(event) {
        // 使用setTimeout确保选择完成后再处理
        setTimeout(() => {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();

            if (selectedText.length > 0) {
                this.selectionText = selectedText;
                console.log('选中文本:', selectedText);
                this.showCopyButton(event);
            } else {
                this.hideButton();
            }
        }, 10);
    }

    showCopyButton(event) {
        // 移除现有的按钮
        this.hideButton();

        // 创建复制按钮容器
        this.copyButton = document.createElement('div');
        this.copyButton.innerHTML = '复制';
        this.copyButton.style.cssText = `
            position: absolute;
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
            color: #007aff;
            padding: 11px 20px;
            border: 1px solid rgba(0, 122, 255, 0.1);
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
            letter-spacing: -0.016em;
            cursor: pointer;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
            user-select: none;
            box-shadow: 0 4px 16px rgba(0, 122, 255, 0.15), 0 2px 8px rgba(0, 122, 255, 0.08);
            transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            opacity: 0;
            transform: translateY(12px) scale(0.95);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        `;

        // 定位按钮到鼠标位置
        this.copyButton.style.left = (event.pageX + 10) + 'px';
        this.copyButton.style.top = (event.pageY + 10) + 'px';

        // 添加悬停效果
        this.copyButton.addEventListener('mouseenter', () => {
            this.copyButton.style.background = 'linear-gradient(135deg, #007aff 0%, #0051d5 100%)';
            this.copyButton.style.color = '#ffffff';
            this.copyButton.style.border = '1px solid rgba(0, 122, 255, 0.3)';
            this.copyButton.style.transform = 'translateY(-2px) scale(1)';
            this.copyButton.style.boxShadow = '0 8px 24px rgba(0, 122, 255, 0.25), 0 4px 12px rgba(0, 122, 255, 0.12)';
        });

        this.copyButton.addEventListener('mouseleave', () => {
            this.copyButton.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)';
            this.copyButton.style.color = '#007aff';
            this.copyButton.style.border = '1px solid rgba(0, 122, 255, 0.1)';
            this.copyButton.style.transform = 'translateY(0) scale(1)';
            this.copyButton.style.boxShadow = '0 4px 16px rgba(0, 122, 255, 0.15), 0 2px 8px rgba(0, 122, 255, 0.08)';
        });

        // 添加点击事件
        this.copyButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.copyToClipboard(event);
        });

        document.body.appendChild(this.copyButton);

        // 触发入场动画
        setTimeout(() => {
            if (this.copyButton) {
                this.copyButton.style.opacity = '1';
                this.copyButton.style.transform = 'translateY(0) scale(1)';
            }
        }, 10);

        // 4秒后自动隐藏
        setTimeout(() => this.hideButton(), 4000);
    }

    hideButton() {
        if (this.copyButton && this.copyButton.parentNode) {
            this.copyButton.parentNode.removeChild(this.copyButton);
            this.copyButton = null;
        }
    }

    async copyToClipboard(event) {
        // 阻止事件冒泡和默认行为
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        try {
            // 使用保存的选中文本，避免选择丢失
            const selectedText = this.selectionText || window.getSelection().toString().trim();

            if (selectedText) {
                console.log('正在复制文本:', selectedText);

                // 先执行复制操作
                try {
                    await navigator.clipboard.writeText(selectedText);
                    console.log('使用现代API复制成功');
                } catch (clipboardError) {
                    console.warn('现代API复制失败，使用降级方案:', clipboardError);
                    // 如果现代API失败，立即使用降级方案
                    await this.fallbackCopyToClipboard(selectedText);
                }

                // 复制成功后再尝试保存记录（不阻塞复制功能）
                try {
                    const saveResult = await this.sendToBackground({
                        type: 'SAVE_COPY',
                        text: selectedText,
                        source: window.location.hostname,
                        timestamp: new Date().toISOString()
                    });

                    if (saveResult.status === 'success') {
                        console.log('复制记录已保存');
                    } else if (saveResult.status === 'fallback') {
                        console.log('使用本地存储备份保存记录');
                    } else {
                        console.warn('保存复制记录失败:', saveResult.error || 'API不可用');
                    }
                } catch (saveError) {
                    console.warn('保存记录时出错，但复制成功:', saveError);
                }

                // 显示复制成功提示
                this.showSuccessMessage();

                // 延迟隐藏按钮，让用户看到成功反馈
                setTimeout(() => this.hideButton(), 500);
            } else {
                console.warn('没有找到要复制的文本');
                this.showErrorMessage('没有选中文本');
            }
        } catch (error) {
            console.error('复制过程出错:', error);

            // 根据错误类型显示不同的错误信息
            let errorMessage = '复制失败';
            if (error.message && error.message.includes('Extension context invalidated')) {
                errorMessage = '插件需要重新加载，请刷新页面后重试';
            } else if (error.message && error.message.includes('clipboard')) {
                errorMessage = '剪贴板访问失败，请检查浏览器权限设置';
            } else if (error.message) {
                errorMessage = `复制失败: ${error.message}`;
            }

            this.showErrorMessage(errorMessage);
        }
    }

    fallbackCopyToClipboard(text) {
        const selectedText = text || this.selectionText || window.getSelection().toString().trim();

        return new Promise((resolve, reject) => {
            if (!selectedText) {
                reject(new Error('没有文本可以复制'));
                return;
            }

            const textArea = document.createElement('textarea');
            textArea.value = selectedText;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            textArea.style.pointerEvents = 'none';
            textArea.setAttribute('readonly', '');
            document.body.appendChild(textArea);

            // 选中文本
            textArea.focus();
            textArea.select();
            textArea.setSelectionRange(0, 99999); // 移动设备兼容

            try {
                const successful = document.execCommand('copy');
                console.log('降级复制结果:', successful);
                if (successful) {
                    resolve(selectedText);
                } else {
                    reject(new Error('execCommand复制失败'));
                }
            } catch (err) {
                console.error('降级复制异常:', err);
                reject(err);
            } finally {
                if (textArea.parentNode) {
                    document.body.removeChild(textArea);
                }
            }
        });
    }

    showSuccessMessage() {
        this.showMessage('✓ 已复制并保存', 'success');
    }

    showErrorMessage(message) {
        this.showMessage('⚠️ ' + message, 'error');
    }

    showMessage(message, type = 'success') {
        // 移除现有消息
        const existingMsg = document.querySelector('.copy-notification');
        if (existingMsg) {
            existingMsg.remove();
        }

        const messageEl = document.createElement('div');
        messageEl.className = `copy-notification ${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            border-radius: 12px;
            z-index: 10001;
            font-size: 14px;
            font-weight: 600;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 8px 32px rgba(0,0,0,0.15);
            backdrop-filter: blur(10px);
            opacity: 0;
            transform: translateX(100px) scale(0.8);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            ${type === 'success'
                ? 'background: linear-gradient(135deg, #34a853 0%, #0d8043 100%); color: white;'
                : 'background: linear-gradient(135deg, #ea4335 0%, #c5221f 100%); color: white;'
            }
        `;

        document.body.appendChild(messageEl);

        // 入场动画
        setTimeout(() => {
            messageEl.style.opacity = '1';
            messageEl.style.transform = 'translateX(0) scale(1)';
        }, 10);

        // 3秒后消失
        setTimeout(() => {
            messageEl.style.opacity = '0';
            messageEl.style.transform = 'translateX(100px) scale(0.8)';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
    }
}

// 初始化复制记录器
const copyRecorder = new CopyRecorder();

// 添加到全局作用域以便调试
window.copyRecorder = copyRecorder;

// 添加键盘快捷键支持 (Ctrl+C 或者 Command+C)
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        if (selectedText.length > 0) {
            console.log('键盘复制检测到文本:', selectedText);
        }
    }
});