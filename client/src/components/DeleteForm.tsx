import { FormEvent, useEffect, useState } from 'react';
import { deleteFile, requestPermission } from '../api';

type Props = {
  defaultPath?: string;
  adminToken?: string | null;
  onDeleted?: () => void;
};

const DeleteForm = ({ defaultPath = '', adminToken, onDeleted }: Props) => {
  const [path, setPath] = useState(defaultPath);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPath(defaultPath);
  }, [defaultPath]);

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!path.trim()) {
      setIsError(true);
      setStatus('请填写目标路径');
      return;
    }

    if (!adminToken && !reason.trim()) {
      setIsError(true);
      setStatus('请填写删除理由');
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      if (adminToken) {
        const result = await deleteFile({
          path: path.trim(),
          adminToken,
        });
        setIsError(false);
        setStatus(result.message || '删除成功');
        if (!defaultPath) {
          setPath('');
        }
        onDeleted?.();
      } else {
        await requestPermission({
          path: path.trim(),
          type: 'DELETE',
          reason: reason.trim(),
        });
        setIsError(false);
        setStatus('删除申请已提交，请等待管理员审核');
        setReason('');
      }
    } catch (error) {
      setIsError(true);
      setStatus(error instanceof Error ? error.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

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
      {adminToken ? (
        <div className="ticket-card compact">
          <div>
            <strong>管理员模式</strong>
            <p className="muted">已使用后台登录，删除时跳过审核</p>
          </div>
          <span className="status-pill success">直连</span>
        </div>
      ) : (
        <div className="input-group">
          <label htmlFor="delete-reason">删除理由</label>
          <input
            id="delete-reason"
            placeholder="请说明删除原因..."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      )}
      <button type="submit" className="secondary" disabled={loading}>
        {loading ? '执行中...' : adminToken ? '删除 HTML' : '提交删除申请'}
      </button>
      {status && <p className={isError ? 'status-error' : 'status-success'}>{status}</p>}
    </form>
  );
};

export default DeleteForm;
