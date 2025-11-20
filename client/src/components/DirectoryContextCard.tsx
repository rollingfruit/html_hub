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

  return (
    <div className="directory-context-card">
      <div>
        <p className="eyebrow">当前主题</p>
        <h2>{path || '根目录'}</h2>
        <p className="muted">{meta?.description || '为该目录添加一句描述，帮助创作者理解内容定位。'}</p>
      </div>
      <div className="prompt-panel">
        <div className="prompt-header">
          <span>System Prompt</span>
          <div className="prompt-actions">
            <button type="button" className="secondary" onClick={handleCopy} disabled={!meta?.systemPrompt}>
              {copied ? '已复制' : '复制提示'}
            </button>
            <button type="button" className="primary" onClick={onEdit}>
              {meta?.systemPrompt ? '编辑' : '创建'}提示
            </button>
          </div>
        </div>
        <div className={meta?.systemPrompt ? 'prompt-body' : 'prompt-body empty'}>
          {meta?.systemPrompt ? <pre>{meta.systemPrompt}</pre> : <span>尚未设置该主题的生成指南</span>}
        </div>
      </div>
    </div>
  );
};

export default DirectoryContextCard;
