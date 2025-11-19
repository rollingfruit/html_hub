import { useCallback, useEffect, useState } from 'react';
import DirectoryTree from '../components/DirectoryTree';
import UploadForm from '../components/UploadForm';
import PermissionRequestForm from '../components/PermissionRequestForm';
import DeleteForm from '../components/DeleteForm';
import { fetchProjects } from '../api';
import { Project, TreeNode } from '../types';

const UserHome = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProjects();
      setProjects(data.projects);
      setTree(data.tree);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const latestUploads = projects.slice(0, 5);

  return (
    <div className="user-home">
      <section className="card">
        <h2>目录总览</h2>
        {loading && <p>加载中...</p>}
        {error && <p className="status-error">{error}</p>}
        {!loading && !error && <DirectoryTree nodes={tree} />}
      </section>

      <section className="card">
        <h2>上传 HTML</h2>
        <UploadForm
          onUploaded={(_project) => {
            loadProjects();
          }}
        />
      </section>

      <section className="card">
        <h2>申请修改 / 删除权限</h2>
        <PermissionRequestForm />
      </section>

      <section className="card">
        <h2>使用 Token 删除文件</h2>
        <DeleteForm />
      </section>

      <section className="card">
        <h2>最近上传</h2>
        <ul>
          {latestUploads.map((project) => (
            <li key={project.id}>
              <a href={project.url} target="_blank" rel="noreferrer">
                {project.path}
              </a>{' '}
              · {new Date(project.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default UserHome;
