/**
 * AI Platform SDK
 * 
 * 一个轻量级 SDK，用于在外部 HTML 应用中接入 AI 平台服务
 * 
 * 使用方法:
 * 1. 在 HTML 中引入此脚本
 * 2. 调用 AIPlatform.init() 初始化
 * 3. 使用 AIPlatform.chat() 调用 AI 服务
 */

(function (global) {
    'use strict';

    const SDK_VERSION = '1.0.0';

    // 默认配置
    const defaultConfig = {
        baseUrl: '', // 将在 init 时根据脚本来源自动检测
        token: null,
        autoLogin: true,
        loginUrl: '/login',
    };

    let config = { ...defaultConfig };
    let currentToken = null;

    /**
     * 获取脚本来源的 baseUrl
     */
    const detectBaseUrl = () => {
        try {
            const scripts = document.getElementsByTagName('script');
            for (let i = scripts.length - 1; i >= 0; i--) {
                const src = scripts[i].src;
                if (src && src.includes('ai-platform-sdk')) {
                    const url = new URL(src);
                    return url.origin;
                }
            }
        } catch (e) {
            console.warn('[AIPlatform] Could not detect base URL from script source');
        }
        return window.location.origin;
    };

    /**
     * 初始化 SDK
     * @param {Object} options - 配置选项
     * @param {string} options.token - 用户认证令牌（可选，可通过 setToken 后续设置）
     * @param {string} options.baseUrl - API 基础 URL（可选，自动检测）
     * @param {boolean} options.autoLogin - 是否在未登录时自动跳转登录页（默认 true）
     */
    const init = (options = {}) => {
        config = {
            ...defaultConfig,
            baseUrl: options.baseUrl || detectBaseUrl(),
            ...options,
        };

        if (options.token) {
            currentToken = options.token;
        }

        // 尝试从 localStorage 恢复 token
        if (!currentToken) {
            try {
                const saved = localStorage.getItem('ai_platform_token');
                if (saved) {
                    currentToken = saved;
                }
            } catch (e) {
                // localStorage 不可用
            }
        }

        console.log(`[AIPlatform] SDK v${SDK_VERSION} initialized`);
        return true;
    };

    /**
     * 设置认证令牌
     * @param {string} token - Supabase access token
     */
    const setToken = (token) => {
        currentToken = token;
        try {
            if (token) {
                localStorage.setItem('ai_platform_token', token);
            } else {
                localStorage.removeItem('ai_platform_token');
            }
        } catch (e) {
            // localStorage 不可用
        }
    };

    /**
     * 获取当前令牌
     */
    const getToken = () => currentToken;

    /**
     * 清除令牌（登出）
     */
    const clearToken = () => setToken(null);

    /**
     * 跳转到登录页面
     */
    const login = () => {
        const loginUrl = config.baseUrl + config.loginUrl;
        const returnUrl = encodeURIComponent(window.location.href);
        window.location.href = `${loginUrl}?returnUrl=${returnUrl}`;
    };

    /**
     * 发起 API 请求
     */
    const request = async (endpoint, options = {}) => {
        if (!currentToken) {
            if (config.autoLogin) {
                login();
                throw new Error('未登录，正在跳转登录页面...');
            }
            throw new Error('未登录，请先调用 AIPlatform.setToken() 或 AIPlatform.login()');
        }

        const url = config.baseUrl + '/api' + endpoint;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}`,
            ...options.headers,
        };

        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                clearToken();
                if (config.autoLogin) {
                    login();
                }
                throw new Error('认证失败，请重新登录');
            }
            if (response.status === 402) {
                throw new Error('积分不足，请充值后再试');
            }
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || '请求失败');
        }

        return response;
    };

    /**
     * 调用 LLM Chat API
     * @param {Object} options - 聊天选项
     * @param {string} options.model - 模型名称 (e.g. 'deepseek-chat', 'gpt-4')
     * @param {Array} options.messages - 消息数组 [{role: 'user', content: '...'}]
     * @param {boolean} options.stream - 是否流式返回（默认 true）
     * @param {function} options.onMessage - 流式消息回调 (text) => {}
     * @param {function} options.onError - 错误回调 (error) => {}
     * @param {function} options.onDone - 完成回调 (fullText) => {}
     * @returns {Promise} - 如果非流式，返回完整响应
     */
    const chat = async (options) => {
        const {
            model,
            messages,
            stream = true,
            onMessage,
            onError,
            onDone,
            ...otherParams
        } = options;

        if (!model || !messages) {
            throw new Error('缺少必要参数: model, messages');
        }

        try {
            const response = await request('/llm/chat', {
                method: 'POST',
                body: JSON.stringify({
                    model,
                    messages,
                    stream,
                    ...otherParams,
                }),
            });

            if (!stream) {
                const data = await response.json();
                if (onDone) onDone(data);
                return data;
            }

            // 处理流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const data = JSON.parse(line.slice(6));
                            // OpenAI 格式
                            if (data.choices?.[0]?.delta?.content) {
                                const text = data.choices[0].delta.content;
                                fullText += text;
                                if (onMessage) onMessage(text);
                            }
                            // Anthropic 格式
                            if (data.delta?.text) {
                                const text = data.delta.text;
                                fullText += text;
                                if (onMessage) onMessage(text);
                            }
                        } catch (e) {
                            // 解析失败忽略
                        }
                    }
                }
            }

            if (onDone) onDone(fullText);
            return fullText;

        } catch (error) {
            if (onError) {
                onError(error);
            } else {
                throw error;
            }
        }
    };

    /**
     * 获取用户资料（包括积分余额）
     */
    const getProfile = async () => {
        const response = await request('/user/profile');
        return response.json();
    };

    /**
     * 获取用户积分余额
     */
    const getCredits = async () => {
        const profile = await getProfile();
        return profile.user?.credits ?? 0;
    };

    /**
     * 获取可用模型列表
     */
    const getModels = async () => {
        const response = await fetch(config.baseUrl + '/api/llm/models');
        const data = await response.json();
        return data.models || [];
    };

    // 导出 SDK
    const AIPlatform = {
        version: SDK_VERSION,
        init,
        setToken,
        getToken,
        clearToken,
        login,
        chat,
        getProfile,
        getCredits,
        getModels,
    };

    // 挂载到全局
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = AIPlatform;
    } else {
        global.AIPlatform = AIPlatform;
    }

})(typeof window !== 'undefined' ? window : this);
