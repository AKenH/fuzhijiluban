// 复制记录板内容脚本
class CopyRecorder {
    constructor() {
        this.copyButton = null;
        this.selectionText = '';
        this.init();
    }

    init() {
        if (this.isChromeRuntimeAvailable()) {
            // 只在点击非按钮区域时隐藏按钮
            document.addEventListener('mousedown', (e) => {
                if (!this.copyButton || !this.copyButton.contains(e.target)) {
                    this.hideButton();
                }
            });

            // 监听选择事件
            document.addEventListener('mouseup', this.handleSelection.bind(this));

            // 全局复制事件监听 - 自动捕获所有文本复制操作
            this.setupGlobalCopyListener();
        } else {
            console.warn('Chrome Runtime API不可用，扩展功能受限');
        }
    }

    // 检查Chrome API是否可用（增强版）
    isChromeRuntimeAvailable() {
        try {
            if (typeof chrome === 'undefined') return false;
            if (!chrome.runtime) return false;

            // 核心检查：访问 runtime.id 会在上下文失效时抛出异常
            const extensionId = chrome.runtime.id;
            if (!extensionId) return false;

            if (typeof chrome.runtime.sendMessage !== 'function') return false;

            return true;
        } catch (e) {
            console.log('Runtime 上下文检测失败:', e.message);
            return false;
        }
    }

    // 发送消息到后台（增强错误处理）
    async sendToBackground(message) {
        if (!this.isChromeRuntimeAvailable()) {
            console.warn('⚠️ Chrome Runtime 不可用，可能需要刷新页面');
            return { status: 'error', error: 'Runtime unavailable' };
        }

        return new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage(message, (response) => {
                    if (chrome.runtime.lastError) {
                        const errorMsg = chrome.runtime.lastError.message;
                        console.warn('发送消息失败:', errorMsg);

                        if (errorMsg.includes('Extension context invalidated')) {
                            console.log('💡 提示：扩展已重新加载，请刷新此页面以恢复功能');
                        }

                        resolve({ status: 'error', error: errorMsg });
                    } else {
                        resolve(response || { status: 'success' });
                    }
                });
            } catch (error) {
                console.warn('发送消息异常:', error.message);
                resolve({ status: 'error', error: error.message });
            }
        });
    }

    // 全局复制监听器 - 自动检测所有文本复制操作
    setupGlobalCopyListener() {
        document.addEventListener('copy', async (e) => {
            setTimeout(async () => {
                try {
                    const text = await navigator.clipboard.readText();
                    if (text && text.trim()) {
                        const trimmedText = text.trim();

                        const result = await this.sendToBackground({
                            type: 'SAVE_COPY',
                            data: {
                                text: trimmedText,
                                source: window.location.hostname,
                                timestamp: new Date().toISOString(),
                                type: 'text'
                            }
                        });

                        if (result.status === 'success') {
                            console.log('✅ 自动检测到文本复制:', trimmedText.substring(0, 50) + (trimmedText.length > 50 ? '...' : ''));
                        }
                    }
                } catch (error) {
                    console.log('读取剪贴板失败，尝试降级方案:', error);
                    const selection = window.getSelection();
                    const selectedText = selection.toString().trim();
                    if (selectedText) {
                        const result = await this.sendToBackground({
                            type: 'SAVE_COPY',
                            data: {
                                text: selectedText,
                                source: window.location.hostname,
                                timestamp: new Date().toISOString(),
                                type: 'text'
                            }
                        });

                        if (result.status === 'success') {
                            console.log('✅ 使用选中文本作为降级方案');
                        }
                    }
                }
            }, 100);
        });
    }

    handleSelection(event) {
        setTimeout(() => {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();

            if (selectedText.length > 0) {
                this.selectionText = selectedText;
                this.showCopyButton(event);
            } else {
                this.hideButton();
            }
        }, 10);
    }

    showCopyButton(event) {
        this.hideButton();

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

        this.copyButton.style.left = (event.pageX + 10) + 'px';
        this.copyButton.style.top = (event.pageY + 10) + 'px';

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

        this.copyButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.copyToClipboard(event);
        });

        document.body.appendChild(this.copyButton);

        setTimeout(() => {
            if (this.copyButton) {
                this.copyButton.style.opacity = '1';
                this.copyButton.style.transform = 'translateY(0) scale(1)';
            }
        }, 10);

        setTimeout(() => this.hideButton(), 4000);
    }

    hideButton() {
        if (this.copyButton && this.copyButton.parentNode) {
            this.copyButton.parentNode.removeChild(this.copyButton);
            this.copyButton = null;
        }
    }

    async copyToClipboard(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        try {
            const selectedText = this.selectionText || window.getSelection().toString().trim();

            if (selectedText) {
                // 先执行复制操作
                let copySuccess = false;
                try {
                    await navigator.clipboard.writeText(selectedText);
                    copySuccess = true;
                } catch (clipboardError) {
                    console.warn('现代API复制失败，使用降级方案:', clipboardError);
                    try {
                        await this.fallbackCopyToClipboard(selectedText);
                        copySuccess = true;
                    } catch (fallbackError) {
                        console.error('降级复制也失败:', fallbackError);
                    }
                }

                if (!copySuccess) {
                    this.showErrorMessage('复制失败，请重试');
                    return;
                }

                // 复制成功后，保存到历史记录
                await this.sendToBackground({
                    type: 'SAVE_COPY',
                    data: {
                        text: selectedText,
                        source: window.location.hostname,
                        timestamp: new Date().toISOString(),
                        type: 'text'
                    }
                });

                this.showSuccessMessage();
                setTimeout(() => this.hideButton(), 500);
            } else {
                this.showErrorMessage('没有选中文本');
            }
        } catch (error) {
            console.error('复制过程出错:', error);
            this.showErrorMessage('复制出错: ' + error.message);
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

            textArea.focus();
            textArea.select();
            textArea.setSelectionRange(0, 99999);

            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    resolve(selectedText);
                } else {
                    reject(new Error('execCommand复制失败'));
                }
            } catch (err) {
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

        setTimeout(() => {
            messageEl.style.opacity = '1';
            messageEl.style.transform = 'translateX(0) scale(1)';
        }, 10);

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