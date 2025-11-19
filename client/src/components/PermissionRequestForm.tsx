import { FormEvent, useEffect, useState } from 'react';
import { requestPermission } from '../api';
import { RequestType } from '../types';

type Props = {
  defaultPath?: string;
};

const PermissionRequestForm = ({ defaultPath = '' }: Props) => {
  const [path, setPath] = useState(defaultPath);
  const [type, setType] = useState<RequestType>('MODIFY');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPath(defaultPath);
  }, [defaultPath]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!path) {
      setFeedback('请填写要操作的路径');
      setIsError(true);
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const result = await requestPermission({ path, type, name, email });
      setIsError(false);
      setFeedback(`申请成功，请记录请求号：${result.requestId}`);
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
      <button type="submit" className="primary" disabled={loading}>
        {loading ? '提交中...' : '申请权限'}
      </button>
      {feedback && <p className={isError ? 'status-error' : 'status-success'}>{feedback}</p>}
    </form>
  );
};

export default PermissionRequestForm;
