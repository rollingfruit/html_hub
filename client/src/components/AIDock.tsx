import { Sparkles, Bot, Zap, Code, Palette, Terminal } from 'lucide-react';

type AIPlatform = {
  name: string;
  url: string;
  icon: React.ReactNode;
  color: string;
  description: string;
};
const AI_PLATFORMS: AIPlatform[] = [
  {
    name: 'ChatGPT',
    url: 'https://chat.openai.com',
    // icon: <img src="https://chat.openai.com/favicon.ico" alt="ChatGPT" width="24" height="24" />,
    icon: <img src="https://registry.npmmirror.com/@lobehub/icons-static-svg/latest/files/icons/openai.svg" alt="ChatGPT" width="24" height="24" />,
    color: '#10b981',
    description: '通用 AI 助手',
  },
  {
    name: 'Claude',
    url: 'https://claude.ai',
    icon: <img src="https://registry.npmmirror.com/@lobehub/icons-static-svg/latest/files/icons/claude-color.svg" alt="Claude" width="24" height="24" />,
    // icon: <img src="https://claude.ai/favicon.ico" alt="Claude" width="24" height="24" />,
    color: '#8b5cf6',
    description: '长文本理解与创作',
  },
  {
    name: 'Gemini',
    url: 'https://aistudio.google.com',
    icon: <img src="https://www.gstatic.com/lamda/images/gemini_favicon_f069958c85030456e93de685481c559f160ea06b.png" alt="Gemini" width="24" height="24" />,
    color: '#06b6d4',
    description: '免费Gemini 3',
  },
  {
    name: 'Grok',
    url: 'https://x.com/i/grok',
    icon: <img src="https://abs.twimg.com/favicons/twitter.3.ico" alt="Grok" width="24" height="24" />,
    color: '#f59e0b',
    description: 'X AI 对话助手',
  },
  {
    name: 'GLM',
    url: 'https://chatglm.cn',
    icon: <img src="https://chatglm.cn/favicon.ico" alt="GLM" width="24" height="24" />,
    color: '#ef4444',
    description: '智谱清言',
  },
  {
    name: 'Kimi',
    url: 'https://kimi.moonshot.cn',
    icon: <img src="https://statics.moonshot.cn/kimi-chat/favicon.ico" alt="Kimi" width="24" height="24" />,
    color: '#6366f1',
    description: '月之暗面 AI 助手',
  },
  {
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
    icon: <img src="https://chat.deepseek.com/favicon.svg" alt="DeepSeek" width="24" height="24" />,
    color: '#0ea5e9',
    description: '深度对话与代码生成',
  },
  {
    name: 'Qwen',
    url: 'https://tongyi.aliyun.com/qianwen',
    icon: <img src="https://unpkg.com/@lobehub/icons-static-svg@1.47.0/icons/qwen-color.svg" alt="Qwen" width="24" height="24" />,
    color: '#ec4899',
    description: '通义千问',
  },
];

type Props = {
  currentPrompt?: string;
};

const AIDock = ({ currentPrompt }: Props) => {
  const handlePlatformClick = (platform: AIPlatform) => {
    // 如果有当前 Prompt，尝试复制到剪贴板
    if (currentPrompt) {
      navigator.clipboard.writeText(currentPrompt).catch(() => {
        // 静默失败
      });
    }
    window.open(platform.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="ai-dock-wrapper">
      <div className="ai-dock-hint">
        <Sparkles size={16} />
        <span>粘贴好所需Prompt，选择 AI 平台去创作</span>
        {currentPrompt && <span className="dock-hint-prompt">（Prompt 已复制到剪贴板）</span>}
      </div>
      <div className="ai-dock">
        {AI_PLATFORMS.map((platform) => (
          <button
            key={platform.name}
            type="button"
            className="dock-item"
            onClick={() => handlePlatformClick(platform)}
            style={{ '--dock-color': platform.color } as React.CSSProperties}
            title={`${platform.name} - ${platform.description}`}
          >
            <div className="dock-icon">{platform.icon}</div>
            <span className="dock-label">{platform.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default AIDock;
