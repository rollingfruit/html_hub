import { useState } from 'react';
import { DirectoryMeta } from '../types';

type Props = {
  path: string;
  meta?: DirectoryMeta;
  onEdit: () => void;
};

const DirectoryContextCard = ({ path, meta, onEdit }: Props) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!meta?.systemPrompt) return;
    try {
      await navigator.clipboard.writeText(meta.systemPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      setCopied(false);
    }
  };

  const displayName = path ? path.split('/').pop() || path : '全部内容';
  const hasPrompt = Boolean(meta?.systemPrompt);

  // 简化版：没有 prompt 时显示精简提示条
  if (!hasPrompt && !meta?.description) {
    return (
      <div className="directory-context-compact">
        <div className="compact-info">
          <h2>{displayName}</h2>
          <span className="muted">为此目录配置 Prompt，让 AI 理解创作风格</span>
        </div>
        <div className="compact-actions">
          <button type="button" className="primary-compact" onClick={onEdit}>
            + 配置 Prompt
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="directory-context-card">
      <div className="context-info">
        <h2>{displayName}</h2>
        {meta?.description && <p className="context-desc">{meta.description}</p>}
      </div>
      <div className="prompt-panel">
        <div className="prompt-header">
          <span>System Prompt</span>
          <div className="prompt-actions">
            <button type="button" className="ghost-compact" onClick={handleCopy} disabled={!hasPrompt}>
              {copied ? '已复制' : '复制'}
            </button>
            <button type="button" className="primary-compact" onClick={onEdit}>
              编辑
            </button>
          </div>
        </div>
        <div className="prompt-body">
          <pre>{meta?.systemPrompt}</pre>
        </div>
      </div>
    </div>
  );
};

export default DirectoryContextCard;
