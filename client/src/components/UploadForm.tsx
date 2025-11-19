import { FormEvent, useRef, useState } from 'react';
import { uploadHtml } from '../api';
import { Project } from '../types';

type Props = {
  onUploaded: (project: Project) => void;
};

const UploadForm = ({ onUploaded }: Props) => {
  const [path, setPath] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setIsError(true);
      setMessage('请选择 HTML 文件');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const response = await uploadHtml({ file, path, token: token || undefined });
      onUploaded(response.project as Project);
      setIsError(false);
      setMessage(response.message || '上传成功');
      setPath('');
      setToken('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : '上传失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="input-group">
        <label htmlFor="path">目录路径（例：team/demo）</label>
        <input
          id="path"
          placeholder="可留空，表示根目录"
          value={path}
          onChange={(event) => setPath(event.target.value)}
        />
      </div>
      <div className="input-group">
        <label htmlFor="file">HTML 文件</label>
        <input ref={fileInputRef} id="file" type="file" accept=".html,.htm" />
      </div>
      <div className="input-group">
        <label htmlFor="token">权限 Token（如需覆盖）</label>
        <input
          id="token"
          placeholder="管理员审批后会发放"
          value={token}
          onChange={(event) => setToken(event.target.value)}
        />
      </div>
      <button type="submit" className="primary" disabled={loading}>
        {loading ? '上传中...' : '上传 HTML'}
      </button>
      {message && <p className={isError ? 'status-error' : 'status-success'}>{message}</p>}
    </form>
  );
};

export default UploadForm;
