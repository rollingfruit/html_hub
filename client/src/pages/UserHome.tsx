import { useCallback, useEffect, useMemo, useState } from 'react';
import UploadForm from '../components/UploadForm';
import PermissionRequestForm from '../components/PermissionRequestForm';
import DeleteForm from '../components/DeleteForm';
import FileExplorer from '../components/FileExplorer';
import DirectoryTree from '../components/DirectoryTree';
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
  const [currentPath, setCurrentPath] = useState('');
  const [search, setSearch] = useState('');
  const [isModalOpen, setModalOpen] = useState(false);
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

  const latestUploads = useMemo(() => projects.slice(0, 3), [projects]);

  const openModal = (tab: DrawerTab) => {
    setModalOpen(true);
    setActiveTab(tab);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const handlePrimaryAction = () => {
    setPrefill({ uploadPath: currentPath, uploadFilename: '', requestPath: currentPath, deletePath: currentPath });
    openModal('upload');
  };

  const handleContextAction = (action: ContextAction, node: TreeNode) => {
    const filePath = node.path;
    const { directory, fileName } = splitPath(filePath);
    if (action === 'request') {
      setPrefill((prev) => ({ ...prev, requestPath: filePath }));
      openModal('request');
    } else if (action === 'delete') {
      setPrefill((prev) => ({ ...prev, deletePath: filePath }));
      openModal('delete');
    } else if (action === 'edit') {
      setPrefill((prev) => ({ ...prev, uploadPath: directory, uploadFilename: fileName }));
      openModal('upload');
    }
  };

  const handleFileMenuClick = (node: TreeNode, position: { x: number; y: number }) => {
    setContextMenu({ x: position.x, y: position.y, node });
  };

  const handleUploadSuccess = () => {
    loadProjects();
    closeModal();
  };

  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>工作台</h2>
          <p className="muted">下午好，Admin。今天想创作什么？</p>
          <button type="button" className="primary full" onClick={handlePrimaryAction}>
            + 上传作品
          </button>
        </div>
        <div className="sidebar-section">
          <p className="section-title">目录</p>
          <DirectoryTree nodes={tree} activePath={currentPath} onSelectPath={setCurrentPath} />
        </div>
        <div className="sidebar-footer">
          <p className="muted">作品数量：{projects.length}</p>
          <p className="muted">
            最新上传：{latestUploads[0] ? new Date(latestUploads[0].createdAt).toLocaleDateString() : '--'}
          </p>
        </div>
      </aside>
      <section className="canvas">
        <header className="canvas-header">
          <div>
            <h1>我的画廊</h1>
            <p className="muted">浏览或管理所有托管在 ECS 的 HTML 作品</p>
          </div>
          <div className="canvas-actions">
            <input
              type="search"
              placeholder="搜索文件..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="button" className="secondary" onClick={() => openModal('request')}>
              申请权限
            </button>
          </div>
        </header>

        <div className="canvas-body">
          {loading && <p>正在加载托管内容...</p>}
          {error && <p className="status-error">{error}</p>}
          {!loading && !error && (
            <FileExplorer
              tree={tree}
              currentPath={currentPath}
              onPathChange={setCurrentPath}
              searchTerm={search}
              onFileMenuClick={handleFileMenuClick}
            />
          )}
        </div>
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

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <h3>{activeTab === 'upload' ? '上传 HTML' : activeTab === 'request' ? '申请权限' : '删除文件'}</h3>
              <button type="button" onClick={closeModal}>
                ✕
              </button>
            </header>
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
                  defaultPath={prefill.uploadPath || currentPath}
                  defaultFilename={prefill.uploadFilename}
                />
              )}
              {activeTab === 'request' && <PermissionRequestForm defaultPath={prefill.requestPath} />}
              {activeTab === 'delete' && <DeleteForm defaultPath={prefill.deletePath} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserHome;
