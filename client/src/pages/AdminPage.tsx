import { useCallback, useEffect, useState } from 'react';
import AdminLogin from '../components/AdminLogin';
import AdminRequestsList from '../components/AdminRequestsList';
import AdminFileManager from '../components/AdminFileManager';
import { fetchAdminRequests } from '../api';
import { FileRequest } from '../types';

const TOKEN_KEY = 'ecs_admin_token';

const AUTH_ERROR_PATTERN = /(未授权|令牌|权限不足)/;

const AdminPage = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [requests, setRequests] = useState<FileRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      const data = await fetchAdminRequests(token);
      setRequests(data.requests);
      setError(null);
      setAuthMessage(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      const status = typeof err === 'object' && err && 'status' in err ? Number((err as { status?: number }).status) : null;
      const isAuthError = status === 401 || AUTH_ERROR_PATTERN.test(message);
      if (isAuthError) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setRequests([]);
        setAuthMessage('管理员令牌已失效，请重新登录');
        setError(null);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleLogin = (newToken: string) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setAuthMessage(null);
    setError(null);
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setRequests([]);
    setError(null);
  };

  if (!token) {
    return (
      <section className="card">
        <h2>管理员登录</h2>
        {authMessage && <p className="status-error">{authMessage}</p>}
        <AdminLogin onLogin={handleLogin} />
      </section>
    );
  }

  return (
    <div className="admin-page">
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>审批列表</h2>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="secondary" onClick={handleLogout}>
              退出
            </button>
            <button className="primary" onClick={loadRequests} disabled={loading}>
              {loading ? '刷新中...' : '刷新'}
            </button>
          </div>
        </div>
        {error && <p className="status-error">{error}</p>}
        <AdminRequestsList token={token} requests={requests} onRefresh={loadRequests} />
      </section>
      <AdminFileManager token={token} />
    </div>
  );
};

export default AdminPage;
