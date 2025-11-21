import { FormEvent, useEffect, useRef, useState } from 'react';
import { uploadHtml } from '../api';
import { Project } from '../types';

type Props = {
  onUploaded: (project: Project) => void;
  defaultPath?: string;
  defaultFilename?: string;
  autoFocusToken?: boolean;
};

const sanitizeTitle = (title: string) =>
  title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'untitled';

const extractTitle = (markup: string) => {
  const match = markup.match(/<title>(.*?)<\/title>/i);
  return match ? match[1] : '';
};

const UploadForm = ({ onUploaded, defaultPath = '', defaultFilename = '', autoFocusToken = false }: Props) => {
  const [mode, setMode] = useState<'file' | 'paste'>('paste');
  const [path] = useState(defaultPath);
  const [token, setToken] = useState('');
  const [content, setContent] = useState('');
  const [filename, setFilename] = useState(defaultFilename || 'untitled.html');
  const [manualFilename, setManualFilename] = useState(Boolean(defaultFilename));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [filenameHighlight, setFilenameHighlight] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tokenInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (autoFocusToken && tokenInputRef.current) {
      tokenInputRef.current.focus();
    } else if (!autoFocusToken && textareaRef.current && mode === 'paste') {
      textareaRef.current.focus();
    }
  }, [autoFocusToken, mode]);

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (mode === 'file') {
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
          throw new Error('请选择 HTML 文件');
        }
        const response = await uploadHtml({ file, path, token: token || undefined });
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
          token: token || undefined,
        });
        onUploaded(response.project as Project);
        setIsError(false);
        setMessage(response.message || '保存成功');
      }
      setContent('');
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : '上传失败');
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
          onClick={() => setMode('file')}
        >
          上传文件
        </button>
        <button
          type="button"
          className={mode === 'paste' ? 'segment active' : 'segment'}
          onClick={() => setMode('paste')}
        >
          粘贴代码
        </button>
      </div>

      {mode === 'file' ? (
        <div className="input-group">
          <label htmlFor="file">选择 HTML 文件</label>
          <input ref={fileInputRef} id="file" type="file" accept=".html,.htm,.txt" />
        </div>
      ) : (
        <>
          <div className="code-editor-wrapper">
            <textarea
              ref={textareaRef}
              id="content"
              className="code-editor"
              placeholder="在此粘贴你的 HTML 代码..."
              rows={12}
              value={content}
              onChange={(event) => setContent(event.target.value)}
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
              }}
            />
            {filenameHighlight && <small className="auto-fill-hint">已从 &lt;title&gt; 自动提取</small>}
          </div>
        </>
      )}

      {isEditMode && (
        <div className="token-section">
          <div className="input-group">
            <label htmlFor="token">权限 Token</label>
            <input
              id="token"
              ref={tokenInputRef}
              placeholder="输入管理员发放的 Token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
            <small className="muted">覆盖已存在的文件需要提供 Token</small>
          </div>
        </div>
      )}

      <button type="submit" className="primary submit-btn" disabled={loading}>
        {loading ? '处理中...' : mode === 'file' ? '上传' : '保存'}
      </button>
      {message && <p className={isError ? 'status-error' : 'status-success'}>{message}</p>}
    </form>
  );
};

export default UploadForm;
