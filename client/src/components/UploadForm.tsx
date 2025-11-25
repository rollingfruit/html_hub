import { FormEvent, useEffect, useRef, useState } from 'react';
import { claimAccessToken, uploadHtml } from '../api';
import { Project } from '../types';
import TicketManager, { Ticket, TICKET_EVENT } from '../lib/ticketManager';

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

const UploadForm = ({
  onUploaded,
  defaultPath = '',
  defaultFilename = '',
  autoFocusToken = false,
  adminToken,
}: Props) => {
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
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [manualTokenMode, setManualTokenMode] = useState(false);
  const [ticketRefreshing, setTicketRefreshing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tokenInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEditMode = Boolean(defaultFilename);
  const requiresToken = isEditMode && !adminToken;
  const ticketPath = TicketManager.normalizePath([path, defaultFilename || ''].filter(Boolean).join('/'));
  const autoTokenActive = requiresToken && ticket?.token && !manualTokenMode;
  const showTokenInput = requiresToken && (!ticket?.token || manualTokenMode);
  const effectiveToken = !requiresToken
    ? undefined
    : !manualTokenMode && ticket?.token
      ? ticket.token
      : token || undefined;
  const ticketStatusLabel =
    ticket?.status === 'APPROVED'
      ? '已批准'
      : ticket?.status === 'REJECTED'
        ? '已拒绝'
      : '等待审批';
  const expiresText = ticket?.expiresAt ? `Token 过期时间：${new Date(ticket.expiresAt).toLocaleString()}` : '';

  useEffect(() => {
    if (defaultFilename) {
      setFilename(defaultFilename);
      setManualFilename(true);
    } else {
      setManualFilename(false);
    }
  }, [defaultFilename]);

  useEffect(() => {
    if (!requiresToken) {
      setTicket(null);
      setManualTokenMode(false);
    }
  }, [requiresToken]);

  useEffect(() => {
    if (autoFocusToken && showTokenInput && tokenInputRef.current) {
      tokenInputRef.current.focus();
      return;
    }
    if ((!autoFocusToken || !showTokenInput) && textareaRef.current && mode === 'paste') {
      textareaRef.current.focus();
    }
  }, [autoFocusToken, mode, showTokenInput]);

  useEffect(() => {
    if (!requiresToken) {
      return;
    }
    if (!ticketPath) {
      setTicket(null);
      return;
    }
    const existing = TicketManager.getTicket(ticketPath, 'MODIFY');
    setTicket(existing);
    if (existing?.token) {
      setToken(existing.token);
      setManualTokenMode(false);
    }
  }, [requiresToken, ticketPath]);

  useEffect(() => {
    if (typeof window === 'undefined' || !requiresToken || !ticketPath) {
      return;
    }
    const handleTicketChange = () => {
      const nextTicket = TicketManager.getTicket(ticketPath, 'MODIFY');
      setTicket(nextTicket);
      if (nextTicket?.token) {
        setToken(nextTicket.token);
        setManualTokenMode(false);
      }
    };
    window.addEventListener(TICKET_EVENT, handleTicketChange as EventListener);
    return () => window.removeEventListener(TICKET_EVENT, handleTicketChange as EventListener);
  }, [requiresToken, ticketPath]);

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

  const handleTicketRefresh = async () => {
    if (!ticket) {
      return;
    }
    setTicketRefreshing(true);
    setIsError(false);
    setMessage(null);
    try {
      const result = await claimAccessToken({
        requestId: ticket.requestId,
        clientSecret: ticket.clientSecret,
      });
      const updated = TicketManager.updateTicket(ticket.requestId, {
        status: result.status,
        token: result.accessToken,
        expiresAt: result.expiresAt,
      });
      setTicket(updated);
      if (result.accessToken && updated) {
        setToken(result.accessToken);
        setManualTokenMode(false);
        setMessage('已自动获取 Token，可继续保存');
      } else {
        setMessage('票据状态已刷新');
      }
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : '刷新失败');
    } finally {
      setTicketRefreshing(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (requiresToken && !adminToken && !effectiveToken) {
      setIsError(true);
      setMessage('请提供 Token');
      return;
    }
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
          token: requiresToken ? effectiveToken : undefined,
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
          token: requiresToken ? effectiveToken : undefined,
          adminToken: adminToken || undefined,
        });
        onUploaded(response.project as Project);
        setIsError(false);
        setMessage(response.message || '保存成功');
      }
      if (manualTokenMode) {
        setToken('');
        setManualTokenMode(false);
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
          <label htmlFor="file">选择 Web 资源文件</label>
          <input
            ref={fileInputRef}
            id="file"
            type="file"
            accept=".html,.htm,.css,.js,.jsx,.ts,.tsx,.json,.txt,.md,.jpg,.jpeg,.png,.gif,.svg,.webp,.ico"
          />
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
              onKeyDown={(event) => {
                // 支持 Tab 键缩进
                if (event.key === 'Tab') {
                  event.preventDefault();
                  const textarea = event.currentTarget;
                  const start = textarea.selectionStart;
                  const end = textarea.selectionEnd;
                  const newContent = content.substring(0, start) + '  ' + content.substring(end);
                  setContent(newContent);
                  // 设置光标位置
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
              }}
            />
            {filenameHighlight && <small className="auto-fill-hint">已从 &lt;title&gt; 自动提取</small>}
          </div>
        </>
      )}

      {isEditMode && (
        <div className="token-section">
          {adminToken && (
            <div className="ticket-card compact">
              <div>
                <strong>管理员模式</strong>
                <p className="muted">已登录后台，可直接覆盖文件</p>
              </div>
              <span className="status-pill success">直连</span>
            </div>
          )}
          {!adminToken && ticket && (
            <div className="ticket-card compact">
              <div>
                <strong>票据 #{ticket.requestId}</strong>
                <p className="muted">
                  状态：{ticketStatusLabel}
                  {ticket.token && ' · Token 已注入'}
                </p>
                {ticket.reason && <p className="muted">理由：{ticket.reason}</p>}
                {expiresText && <p className="muted">{expiresText}</p>}
              </div>
              <div className="ticket-actions">
                <span className={ticket.token ? 'status-pill success' : 'status-pill'}>
                  {ticket.token ? '已授权' : '审批中'}
                </span>
                <button
                  type="button"
                  className="ghost-compact"
                  onClick={handleTicketRefresh}
                  disabled={ticketRefreshing}
                >
                  {ticketRefreshing ? '刷新中...' : '刷新状态'}
                </button>
              </div>
            </div>
          )}
          {!adminToken && autoTokenActive && (
            <div className="ticket-hint">
              <p>票据 Token 已自动填入。</p>
              <button type="button" className="ghost-compact" onClick={() => setManualTokenMode(true)}>
                使用其他 Token
              </button>
            </div>
          )}
          {showTokenInput && (
            <div className="input-group">
              <label htmlFor="token">权限 Token</label>
              <input
                id="token"
                ref={tokenInputRef}
                placeholder="输入管理员发放的 Token"
                value={token}
                onChange={(event) => setToken(event.target.value)}
              />
            </div>
          )}
          {!adminToken && <small className="muted">覆盖已存在的文件需要提供 Token</small>}
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
