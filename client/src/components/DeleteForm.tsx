import { FormEvent, useEffect, useState } from 'react';
import { deleteFile } from '../api';

type Props = {
  defaultPath?: string;
};

const DeleteForm = ({ defaultPath = '' }: Props) => {
  const [path, setPath] = useState(defaultPath);
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPath(defaultPath);
  }, [defaultPath]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!path || !token) {
      setIsError(true);
      setStatus('请填写路径和 Token');
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const result = await deleteFile({ path, token });
      setIsError(false);
      setStatus(result.message || '删除成功');
      if (!defaultPath) {
        setPath('');
      }
      setToken('');
    } catch (error) {
      setIsError(true);
      setStatus(error instanceof Error ? error.message : '删除失败');
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
      <div className="input-group">
        <label htmlFor="delete-token">审批 Token</label>
        <input
          id="delete-token"
          placeholder="管理员审核后提供"
          value={token}
          onChange={(event) => setToken(event.target.value)}
        />
      </div>
      <button type="submit" className="secondary" disabled={loading}>
        {loading ? '执行中...' : '删除 HTML'}
      </button>
      {status && <p className={isError ? 'status-error' : 'status-success'}>{status}</p>}
    </form>
  );
};

export default DeleteForm;
