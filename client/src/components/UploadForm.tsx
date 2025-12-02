import { FormEvent, useEffect, useRef, useState } from 'react';
import { uploadHtml } from '../api';
import { Project } from '../types';

type Props = {
  onUploaded: (project: Project) => void;
  defaultPath?: string;
  defaultFilename?: string;
  autoFocusToken?: boolean;
  adminToken?: string | null;
};

const sanitizeTitle = (title: string) =>
  title
    .trim()
    .toLowerCase()
    // 替换空格和其他分隔符为连字符，同时保留中文字符
    .replace(/\s+/g, '-')
    .replace(/[\[\](){}.,;:!@#$%^&+=<>:"\/\\|?*\x00-\x1f]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'untitled';

const extractTitle = (markup: string) => {
  const match = markup.match(/<title>(.*?)<\/title>/i);
  return match ? match[1] : '';
};

/**
 * 清洗从 AI 平台复制来的 Markdown 代码块
 * 支持的格式：
 * - ```html ... ```
 * - ```HTML ... ```
 * - ``` ... ``` (无语言标识)
 */
const cleanMarkdownCodeBlock = (text: string): string => {
  const trimmed = text.trim();

  // 匹配 Markdown 代码块：```语言标识（可选）\n内容\n```
  const codeBlockRegex = /^```(?:html|HTML)?\s*\n([\s\S]*?)\n```$/;
  const match = trimmed.match(codeBlockRegex);

  if (match) {
    return match[1].trim();
  }

  return text;
};

const UploadForm = ({
  onUploaded,
  defaultPath = '',
  defaultFilename = '',
  autoFocusToken = false,
  adminToken,
}: Props) => {
  const [mode, setMode] = useState<'file' | 'paste'>('paste');
  const [path, setPath] = useState(defaultPath);
  const [content, setContent] = useState('');
  const [filename, setFilename] = useState(defaultFilename || 'untitled.html');
  const [manualFilename, setManualFilename] = useState(Boolean(defaultFilename));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [filenameHighlight, setFilenameHighlight] = useState(false);
  const [pasteHint, setPasteHint] = useState<string | null>(null);

  // New state for request flow
  const [reason, setReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEditMode = Boolean(defaultFilename);

  useEffect(() => {
    if (defaultFilename) {
      setFilename(defaultFilename);
      setManualFilename(true);
    } else {
      setManualFilename(false);
    }
  }, [defaultFilename]);

  // Auto-fill path from URL query params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlPath = params.get('path');
      if (!defaultPath && urlPath) {
        setPath((prev) => prev || urlPath);
      }
    }
  }, [defaultPath]);

  useEffect(() => {
    if (mode !== 'paste' || manualFilename) {
      return;
    }
    const extractedTitle = extractTitle(content);
    if (extractedTitle) {
      const safe = sanitizeTitle(extractedTitle);
      setFilename(`${safe}.html`);
      setFilenameHighlight(true);
      setTimeout(() => setFilenameHighlight(false), 1000);
    } else if (!content.trim()) {
      setFilename('untitled.html');
    }
  }, [content, manualFilename, mode]);

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = event.clipboardData.getData('text');
    const cleaned = cleanMarkdownCodeBlock(pastedText);

    if (cleaned !== pastedText) {
      event.preventDefault();
      setContent(cleaned);
      setPasteHint('已自动清洗 Markdown 代码块标记');
      setTimeout(() => setPasteHint(null), 3000);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    // Handle Request Permission Flow
    if (showReasonInput) {
      if (!reason.trim()) {
        setIsError(true);
        setMessage('请填写修改理由');
        return;
      }
      setLoading(true);
      try {
        let fileContent = content;
        let targetFilename = filename;

        if (mode === 'file') {
          const file = fileInputRef.current?.files?.[0];
          if (!file) throw new Error('请选择文件');
          targetFilename = file.name;
          fileContent = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
          });
        } else {
          if (!content.trim()) throw new Error('内容不能为空');
        }

        const fullPath = path ? `${path}/${targetFilename}` : targetFilename;

        await import('../api').then(m => m.requestPermission({
          path: fullPath,
          type: 'MODIFY',
          reason: reason,
          content: fileContent
        }));

        setMessage('修改申请已提交，请等待管理员审核，审核通过后页面将自动更新。');
        setIsError(false);
        setShowReasonInput(false);
        setReason('');
      } catch (error) {
        setIsError(true);
        setMessage(error instanceof Error ? error.message : '申请失败');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Handle Normal Upload Flow
    setLoading(true);
    try {
      if (mode === 'file') {
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
          throw new Error('请选择 HTML 文件');
        }
        const response = await uploadHtml({
          file,
          path,
          adminToken: adminToken || undefined,
        });
        onUploaded(response.project as Project);
        setIsError(false);
        setMessage(response.message || '上传成功');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        if (!content.trim()) {
          throw new Error('请粘贴 HTML 内容');
        }
        const safeFilename = filename || 'index.html';
        const response = await uploadHtml({
          content,
          filename: safeFilename,
          path,
          adminToken: adminToken || undefined,
        });
        onUploaded(response.project as Project);
        setIsError(false);
        setMessage(response.message || '保存成功');
      }
      setContent('');
    } catch (error) {
      const err = error as any;
      if (err.status === 403 && !adminToken) {
        setShowReasonInput(true);
        setMessage('文件已存在，请填写理由并提交修改申请');
        setIsError(false);
      } else {
        setIsError(true);
        setMessage(err.message || '上传失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const displayPath = path ? path.split('/').join(' / ') : '根目录';

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <div className="location-badge">
        <span className="badge-icon">📂</span>
        <span className="badge-text">保存至：{displayPath}</span>
      </div>

      <div className="segmented-control">
        <button
          type="button"
          className={mode === 'file' ? 'segment active' : 'segment'}
          onClick={() => { setMode('file'); setShowReasonInput(false); setMessage(null); }}
        >
          上传文件
        </button>
        <button
          type="button"
          className={mode === 'paste' ? 'segment active' : 'segment'}
          onClick={() => { setMode('paste'); setShowReasonInput(false); setMessage(null); }}
        >
          粘贴代码
        </button>
      </div>

      {mode === 'file' ? (
        <div className="input-group">
          <label htmlFor="file">选择 Web 资源文件</label>
          <input
            ref={fileInputRef}
            id="file"
            type="file"
            accept=".html,.htm,.css,.js,.jsx,.ts,.tsx,.json,.txt,.md,.jpg,.jpeg,.png,.gif,.svg,.webp,.ico"
            onChange={() => { setShowReasonInput(false); setMessage(null); }}
          />
        </div>
      ) : (
        <>
          <div className="code-editor-wrapper">
            {pasteHint && (
              <div className="paste-hint">
                ✨ {pasteHint}
              </div>
            )}
            <textarea
              ref={textareaRef}
              id="content"
              className="code-editor"
              placeholder="在此粘贴你的 HTML 代码...
支持自动清洗 Markdown 代码块（```html...```）"
              rows={12}
              value={content}
              onChange={(event) => { setContent(event.target.value); setShowReasonInput(false); setMessage(null); }}
              onPaste={handlePaste}
              onKeyDown={(event) => {
                if (event.key === 'Tab') {
                  event.preventDefault();
                  const textarea = event.currentTarget;
                  const start = textarea.selectionStart;
                  const end = textarea.selectionEnd;
                  const newContent = content.substring(0, start) + '  ' + content.substring(end);
                  setContent(newContent);
                  setTimeout(() => {
                    textarea.selectionStart = textarea.selectionEnd = start + 2;
                  }, 0);
                }
              }}
            />
          </div>
          <div className={`input-group ${filenameHighlight ? 'highlight-pulse' : ''}`}>
            <label htmlFor="filename">文件名</label>
            <input
              id="filename"
              value={filename}
              placeholder="example.html"
              onChange={(event) => {
                setManualFilename(true);
                setFilename(event.target.value);
                setShowReasonInput(false);
                setMessage(null);
              }}
            />
            {filenameHighlight && <small className="auto-fill-hint">已从 &lt;title&gt; 自动提取</small>}
          </div>
        </>
      )}

      {adminToken && (
        <div className="token-section">
          <div className="ticket-card compact">
            <div>
              <strong>管理员模式</strong>
              <p className="muted">已登录后台，可直接覆盖文件</p>
            </div>
            <span className="status-pill success">直连</span>
          </div>
        </div>
      )}

      {showReasonInput && !adminToken && (
        <div className="input-group slide-down">
          <label htmlFor="reason">修改理由</label>
          <input
            id="reason"
            placeholder="请说明修改原因..."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            autoFocus
          />
          <small className="status-warning">文件已存在，需要管理员审核通过后生效</small>
        </div>
      )}

      <button type="submit" className={`primary submit-btn ${showReasonInput ? 'warning' : ''}`} disabled={loading}>
        {loading ? '处理中...' : showReasonInput ? '提交修改申请' : (mode === 'file' ? '上传' : '保存')}
      </button>
      {message && <p className={isError ? 'status-error' : 'status-success'}>{message}</p>}
    </form>
  );
};

export default UploadForm;
