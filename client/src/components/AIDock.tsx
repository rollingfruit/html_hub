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
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
    icon: <Sparkles size={24} />,
    color: '#0ea5e9',
    description: '深度对话与代码生成',
  },
  {
    name: 'ChatGPT',
    url: 'https://chat.openai.com',
    icon: <Bot size={24} />,
    color: '#10b981',
    description: '通用 AI 助手',
  },
  {
    name: 'Claude',
    url: 'https://claude.ai',
    icon: <Zap size={24} />,
    color: '#8b5cf6',
    description: '长文本理解与创作',
  },
  {
    name: 'v0.dev',
    url: 'https://v0.dev',
    icon: <Palette size={24} />,
    color: '#f59e0b',
    description: 'UI 组件生成',
  },
  {
    name: 'Bolt.new',
    url: 'https://bolt.new',
    icon: <Zap size={24} />,
    color: '#ef4444',
    description: '全栈应用快速生成',
  },
  {
    name: 'Gemini',
    url: 'https://aistudio.google.com',
    icon: <Code size={24} />,
    color: '#06b6d4',
    description: 'Google AI Studio',
  },
  {
    name: 'Cursor',
    url: 'https://cursor.sh',
    icon: <Terminal size={24} />,
    color: '#6366f1',
    description: 'AI 编辑器',
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
        <span>选择 AI 平台开始创作</span>
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
