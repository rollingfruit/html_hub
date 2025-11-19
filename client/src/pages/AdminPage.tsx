import { useCallback, useEffect, useState } from 'react';
import AdminLogin from '../components/AdminLogin';
import AdminRequestsList from '../components/AdminRequestsList';
import { fetchAdminRequests } from '../api';
import { FileRequest } from '../types';

const TOKEN_KEY = 'ecs_admin_token';

const AdminPage = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [requests, setRequests] = useState<FileRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      const data = await fetchAdminRequests(token);
      setRequests(data.requests);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
      if (err instanceof Error && err.message.includes('未授权')) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
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
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setRequests([]);
  };

  if (!token) {
    return (
      <section className="card">
        <h2>管理员登录</h2>
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
    </div>
  );
};

export default AdminPage;
