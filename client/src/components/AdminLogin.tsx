import { FormEvent, useState } from 'react';
import { loginAdmin } from '../api';

type Props = {
  onLogin: (token: string) => void;
};

const AdminLogin = ({ onLogin }: Props) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await loginAdmin({ username, password });
      onLogin(result.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="input-group">
        <label htmlFor="admin-username">用户名</label>
        <input id="admin-username" value={username} onChange={(event) => setUsername(event.target.value)} />
      </div>
      <div className="input-group">
        <label htmlFor="admin-password">密码</label>
        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <button type="submit" className="primary" disabled={loading}>
        {loading ? '登录中...' : '登录'}
      </button>
      {error && <p className="status-error">{error}</p>}
    </form>
  );
};

export default AdminLogin;
