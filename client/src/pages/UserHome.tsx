import { useCallback, useEffect, useMemo, useState } from 'react';
import UploadForm from '../components/UploadForm';
import PermissionRequestForm from '../components/PermissionRequestForm';
import DeleteForm from '../components/DeleteForm';
import FileExplorer from '../components/FileExplorer';
import ContextMenu, { ContextAction } from '../components/ContextMenu';
import { fetchProjects } from '../api';
import { Project, TreeNode } from '../types';

type DrawerTab = 'upload' | 'request' | 'delete';

type ContextMenuState = {
  x: number;
  y: number;
  node: TreeNode;
};

const splitPath = (path: string) => {
  const parts = path.split('/');
  const fileName = parts.pop() || '';
  return {
    directory: parts.join('/'),
    fileName,
  };
};

const UserHome = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>('upload');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [prefill, setPrefill] = useState({
    uploadPath: '',
    uploadFilename: '',
    requestPath: '',
    deletePath: '',
  });

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

  const latestUploads = useMemo(() => projects.slice(0, 4), [projects]);

  const handleFileMenuClick = (node: TreeNode, position: { x: number; y: number }) => {
    setContextMenu({
      x: position.x,
      y: position.y,
      node,
    });
  };

  const openDrawer = (tab: DrawerTab) => {
    setDrawerOpen(true);
    setActiveTab(tab);
  };

  const handleContextAction = (action: ContextAction, node: TreeNode) => {
    const filePath = node.path;
    const { directory, fileName } = splitPath(filePath);
    if (action === 'request') {
      setPrefill((prev) => ({ ...prev, requestPath: filePath }));
      openDrawer('request');
    } else if (action === 'delete') {
      setPrefill((prev) => ({ ...prev, deletePath: filePath }));
      openDrawer('delete');
    } else if (action === 'edit') {
      setPrefill((prev) => ({ ...prev, uploadPath: directory, uploadFilename: fileName }));
      openDrawer('upload');
    }
  };

  const handleUploadSuccess = () => {
    loadProjects();
  };

  const toggleDrawer = () => {
    setDrawerOpen((prev) => !prev);
  };

  return (
    <div className="user-home">
      <section className="hero card">
        <div>
          <p className="eyebrow">ECS HTML 共创平台</p>
          <h2>立即浏览与分发所有托管 HTML</h2>
          <p className="muted">
            以画廊形式快速预览作品，也可在底部操作面板中上传或申请权限，管理员审核后即可线上协作。
          </p>
        </div>
        <div className="hero-stats">
          <div>
            <span className="stat-label">作品数量</span>
            <strong className="stat-value">{projects.length}</strong>
          </div>
          <div>
            <span className="stat-label">最新上传</span>
            <strong className="stat-value">
              {latestUploads[0] ? new Date(latestUploads[0].createdAt).toLocaleDateString() : '--'}
            </strong>
          </div>
        </div>
      </section>

      <section className="card explorer-wrapper">
        {loading && <p>正在加载托管内容...</p>}
        {error && <p className="status-error">{error}</p>}
        {!loading && !error && <FileExplorer tree={tree} onFileMenuClick={handleFileMenuClick} />}
      </section>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={contextMenu.node}
          onSelect={handleContextAction}
          onClose={() => setContextMenu(null)}
        />
      )}

      <div className={`action-drawer ${drawerOpen ? 'open' : ''}`}>
        <button type="button" className="drawer-toggle" onClick={toggleDrawer}>
          {drawerOpen ? '收起操作面板' : '上传 / 管理 HTML'}
        </button>
        <div className="drawer-content">
          <div className="drawer-tabs">
            <button
              type="button"
              className={activeTab === 'upload' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('upload')}
            >
              上传 HTML
            </button>
            <button
              type="button"
              className={activeTab === 'request' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('request')}
            >
              申请权限
            </button>
            <button
              type="button"
              className={activeTab === 'delete' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('delete')}
            >
              Token 删除
            </button>
          </div>
          <div className="drawer-panel">
            {activeTab === 'upload' && (
              <UploadForm
                onUploaded={handleUploadSuccess}
                defaultPath={prefill.uploadPath}
                defaultFilename={prefill.uploadFilename}
              />
            )}
            {activeTab === 'request' && <PermissionRequestForm defaultPath={prefill.requestPath} />}
            {activeTab === 'delete' && <DeleteForm defaultPath={prefill.deletePath} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserHome;
