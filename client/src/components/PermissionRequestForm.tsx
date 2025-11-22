import { FormEvent, useEffect, useState } from 'react';
import { claimAccessToken, requestPermission } from '../api';
import { RequestType } from '../types';
import TicketManager, { Ticket, TICKET_EVENT } from '../lib/ticketManager';

type Props = {
  defaultPath?: string;
};

const PermissionRequestForm = ({ defaultPath = '' }: Props) => {
  const [path, setPath] = useState(defaultPath);
  const [type, setType] = useState<RequestType>('MODIFY');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    setPath(defaultPath);
  }, [defaultPath]);

  useEffect(() => {
    if (!path) {
      setTicket(null);
      return;
    }
    const normalized = TicketManager.normalizePath(path);
    if (!normalized) {
      setTicket(null);
      return;
    }
    const existing = TicketManager.getTicket(normalized, type);
    setTicket(existing);
  }, [path, type]);

  useEffect(() => {
    if (typeof window === 'undefined') {
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
      const nextTicket = TicketManager.getTicket(normalized, type);
      setTicket(nextTicket);
    };
    window.addEventListener(TICKET_EVENT, handleTicketChange as EventListener);
    return () => window.removeEventListener(TICKET_EVENT, handleTicketChange as EventListener);
  }, [path, type]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedPath = TicketManager.normalizePath(path);
    if (!normalizedPath) {
      setFeedback('请填写要操作的路径');
      setIsError(true);
      return;
    }
    if (!reason.trim()) {
      setFeedback('请填写申请理由');
      setIsError(true);
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const clientSecret = TicketManager.generateSecret();
      const result = await requestPermission({
        path: normalizedPath,
        type,
        name,
        email,
        reason: reason.trim(),
        clientSecret,
      });
      setIsError(false);
      setFeedback('申请成功，小票已保存在本地票据箱中');
      const newTicket = TicketManager.createTicket({
        requestId: result.requestId,
        path: normalizedPath,
        type,
        clientSecret,
        reason: reason.trim(),
      });
      setTicket(newTicket);
      if (!defaultPath) {
        setPath('');
      }
    } catch (error) {
      setIsError(true);
      setFeedback(error instanceof Error ? error.message : '申请失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshTicket = async () => {
    if (!ticket) {
      return;
    }
    setRefreshing(true);
    setFeedback(null);
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
      if (result.accessToken) {
        setFeedback('已自动获取 Token，前往上传 / 删除时将自动填写。');
        setIsError(false);
      } else {
        setIsError(false);
        setFeedback('状态已刷新');
      }
    } catch (error) {
      setIsError(true);
      setFeedback(error instanceof Error ? error.message : '刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  const handleResetTicket = () => {
    if (!ticket) {
      return;
    }
    TicketManager.removeTicket(ticket.requestId);
    setTicket(null);
  };

  const statusLabel =
    ticket?.status === 'APPROVED'
      ? '已批准'
      : ticket?.status === 'REJECTED'
        ? '已拒绝'
        : '等待审批';
  const expiresText = ticket?.expiresAt ? `Token 过期时间：${new Date(ticket.expiresAt).toLocaleString()}` : '';

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="input-group">
        <label htmlFor="request-path">目标路径（包含文件名）</label>
        <input
          id="request-path"
          placeholder="例：team/demo/index.html"
          value={path}
          onChange={(event) => setPath(event.target.value)}
        />
      </div>
      <div className="input-group">
        <label htmlFor="request-type">申请类型</label>
        <select id="request-type" value={type} onChange={(event) => setType(event.target.value as RequestType)}>
          <option value="MODIFY">修改 / 覆盖</option>
          <option value="DELETE">删除</option>
        </select>
      </div>
      <div className="input-group">
        <label htmlFor="request-name">联系姓名</label>
        <input id="request-name" value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="input-group">
        <label htmlFor="request-email">联系邮箱</label>
        <input id="request-email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <div className="input-group">
        <label htmlFor="request-reason">申请理由</label>
        <textarea
          id="request-reason"
          rows={3}
          placeholder="简要说明你需要修改 / 删除该 HTML 的原因"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
      <p className="muted">申请后浏览器将保存票据号，请使用“刷新状态”按钮查询授权结果。</p>
      <button type="submit" className="primary" disabled={loading}>
        {loading ? '提交中...' : '申请权限'}
      </button>
      {ticket && (
        <div className="ticket-card">
          <div className="ticket-meta">
            <div>
              <strong>票据 #{ticket.requestId}</strong>
              <p className="muted">
                状态：{statusLabel}
                {ticket.token && ' · 已获取 Token'}
              </p>
              {ticket.reason && <p className="muted">理由：{ticket.reason}</p>}
              {expiresText && <p className="muted">{expiresText}</p>}
            </div>
            <span className={ticket.token ? 'status-pill success' : 'status-pill'}>
              {ticket.token ? '已自动授权' : '待授权'}
            </span>
          </div>
          <div className="ticket-actions">
            <button type="button" className="secondary" onClick={handleResetTicket}>
              清除票据
            </button>
            <button type="button" className="primary" onClick={handleRefreshTicket} disabled={refreshing}>
              {refreshing ? '刷新中...' : '刷新状态'}
            </button>
          </div>
        </div>
      )}
      {feedback && <p className={isError ? 'status-error' : 'status-success'}>{feedback}</p>}
    </form>
  );
};

export default PermissionRequestForm;
