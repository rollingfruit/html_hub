import { FormEvent, useEffect, useRef, useState } from 'react';
import { uploadHtml } from '../api';
import { Project } from '../types';

type Props = {
  onUploaded: (project: Project) => void;
  defaultPath?: string;
  defaultFilename?: string;
};

const UploadForm = ({ onUploaded, defaultPath = '', defaultFilename = '' }: Props) => {
  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [path, setPath] = useState(defaultPath);
  const [token, setToken] = useState('');
  const [content, setContent] = useState('');
  const [filename, setFilename] = useState(defaultFilename || 'index.html');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPath(defaultPath);
  }, [defaultPath]);

  useEffect(() => {
    if (defaultFilename) {
      setFilename(defaultFilename);
    }
  }, [defaultFilename]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (mode === 'file') {
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
          throw new Error('请选择 HTML 文件');
        }
        const response = await uploadHtml({ file, path, token: token || undefined });
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
          token: token || undefined,
        });
        onUploaded(response.project as Project);
        setIsError(false);
        setMessage(response.message || '保存成功');
      }
      setContent('');
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : '上传失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
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

      <div className="input-group">
        <label htmlFor="path">目录路径（例：team/demo）</label>
        <input
          id="path"
          placeholder="可留空，表示根目录"
          value={path}
          onChange={(event) => setPath(event.target.value)}
        />
      </div>

      {mode === 'file' ? (
        <div className="input-group">
          <label htmlFor="file">HTML 文件</label>
          <input ref={fileInputRef} id="file" type="file" accept=".html,.htm,.txt" />
        </div>
      ) : (
        <>
          <div className="input-group">
            <label htmlFor="filename">文件名</label>
            <input
              id="filename"
              value={filename}
              placeholder="example.html"
              onChange={(event) => setFilename(event.target.value)}
            />
          </div>
          <div className="input-group">
            <label htmlFor="content">HTML 内容</label>
            <textarea
              id="content"
              placeholder="直接粘贴 HTML 代码..."
              rows={10}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </div>
        </>
      )}

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
        {loading ? '处理中...' : mode === 'file' ? '上传 HTML' : '保存为 HTML'}
      </button>
      {message && <p className={isError ? 'status-error' : 'status-success'}>{message}</p>}
    </form>
  );
};

export default UploadForm;
