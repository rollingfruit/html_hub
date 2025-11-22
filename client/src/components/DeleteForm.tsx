import { FormEvent, useEffect, useState } from 'react';
import { claimAccessToken, deleteFile } from '../api';
import TicketManager, { Ticket, TICKET_EVENT } from '../lib/ticketManager';

type Props = {
  defaultPath?: string;
  adminToken?: string | null;
  onDeleted?: () => void;
};

const DeleteForm = ({ defaultPath = '', adminToken, onDeleted }: Props) => {
  const [path, setPath] = useState(defaultPath);
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setPath(defaultPath);
  }, [defaultPath]);

  useEffect(() => {
    if (!path || adminToken) {
      setTicket(null);
      return;
    }
    const normalized = TicketManager.normalizePath(path);
    if (!normalized) {
      setTicket(null);
      return;
    }
    const existing = TicketManager.getTicket(normalized, 'DELETE');
    setTicket(existing);
    if (existing?.token) {
      setToken(existing.token);
      setManualMode(false);
    }
  }, [path, adminToken]);

  useEffect(() => {
    if (typeof window === 'undefined' || adminToken) {
      return;
    }
    const handleTicketChange = () => {
      if (!path) {
        return;
      }
      const normalized = TicketManager.normalizePath(path);
      if (!normalized) {
        setTicket(null);
        return;
      }
      const nextTicket = TicketManager.getTicket(normalized, 'DELETE');
      setTicket(nextTicket);
      if (nextTicket?.token) {
        setToken(nextTicket.token);
        setManualMode(false);
      }
    };
    window.addEventListener(TICKET_EVENT, handleTicketChange as EventListener);
    return () => window.removeEventListener(TICKET_EVENT, handleTicketChange as EventListener);
  }, [path, adminToken]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedPath = TicketManager.normalizePath(path);
    if (!normalizedPath) {
      setIsError(true);
      setStatus('请填写目标路径');
      return;
    }
    const effectiveToken = adminToken
      ? undefined
      : !manualMode && ticket?.token
        ? ticket.token
        : token;
    if (!adminToken && !effectiveToken) {
      setIsError(true);
      setStatus('请先获取 Token 或使用票据授权');
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const result = await deleteFile({
        path: normalizedPath,
        token: effectiveToken,
        adminToken: adminToken || undefined,
      });
      setIsError(false);
      setStatus(result.message || '删除成功');
      if (ticket) {
        TicketManager.removeTicket(ticket.requestId);
        setTicket(null);
      }
      setToken('');
      setManualMode(false);
      if (!defaultPath) {
        setPath('');
      }
      onDeleted?.();
    } catch (error) {
      setIsError(true);
      setStatus(error instanceof Error ? error.message : '删除失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTicketRefresh = async () => {
    if (!ticket) {
      return;
    }
    setRefreshing(true);
    setIsError(false);
    setStatus(null);
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
        setManualMode(false);
        setStatus('已自动获取 Token，可继续删除');
      } else {
        setStatus('票据状态已刷新');
      }
    } catch (error) {
      setIsError(true);
      setStatus(error instanceof Error ? error.message : '刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  const statusLabel =
    ticket?.status === 'APPROVED'
      ? '已批准'
      : ticket?.status === 'REJECTED'
        ? '已拒绝'
        : '等待审批';
  const showTokenInput = !adminToken && (!ticket?.token || manualMode);

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="input-group">
        <label htmlFor="delete-path">目标路径</label>
        <input
          id="delete-path"
          placeholder="例：team/demo/index.html"
          value={path}
          onChange={(event) => setPath(event.target.value)}
        />
      </div>
      {adminToken && (
        <div className="ticket-card compact">
          <div>
            <strong>管理员模式</strong>
            <p className="muted">已使用后台登录，删除时跳过 Token 校验</p>
          </div>
          <span className="status-pill success">直连</span>
        </div>
      )}
      {!adminToken && ticket && (
        <div className="ticket-card compact">
          <div>
            <strong>票据 #{ticket.requestId}</strong>
            <p className="muted">
              状态：{statusLabel}
              {ticket.token && ' · 自动注入 Token'}
            </p>
          </div>
          <div className="ticket-actions">
            <span className={ticket.token ? 'status-pill success' : 'status-pill'}>
              {ticket.token ? '已授权' : '审批中'}
            </span>
            <button
              type="button"
              className="ghost-compact"
              onClick={handleTicketRefresh}
              disabled={refreshing}
            >
              {refreshing ? '刷新中...' : '刷新状态'}
            </button>
          </div>
        </div>
      )}
      {!adminToken && ticket?.token && !manualMode && (
        <div className="ticket-hint">
          <p>检测到已通过的票据，Token 已自动填入。</p>
          <button type="button" className="ghost-compact" onClick={() => setManualMode(true)}>
            使用其他 Token
          </button>
        </div>
      )}
      {showTokenInput && (
        <div className="input-group">
          <label htmlFor="delete-token">审批 Token</label>
          <input
            id="delete-token"
            placeholder="管理员审核后提供"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </div>
      )}
      <button type="submit" className="secondary" disabled={loading}>
        {loading ? '执行中...' : '删除 HTML'}
      </button>
      {status && <p className={isError ? 'status-error' : 'status-success'}>{status}</p>}
    </form>
  );
};

export default DeleteForm;
