import { useCallback, useEffect, useMemo, useState } from 'react';
import UploadForm from '../components/UploadForm';
import PermissionRequestForm from '../components/PermissionRequestForm';
import DeleteForm from '../components/DeleteForm';
import FileExplorer from '../components/FileExplorer';
import DirectoryTree from '../components/DirectoryTree';
import ContextMenu, { ContextAction } from '../components/ContextMenu';
import { fetchProjects } from '../api';
import { Project, TreeNode } from '../types';

type ModalType = 'UPLOAD' | 'REQUEST' | 'DELETE' | null;

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
  const [modalType, setModalType] = useState<ModalType>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [prefill, setPrefill] = useState({
    uploadPath: '',
    uploadFilename: '',
    requestPath: '',
    deletePath: '',
  });
  const [focusToken, setFocusToken] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [cachedSidebarWidth, setCachedSidebarWidth] = useState(260);
  const [isSidebarOpen, setSidebarOpen] = useState(true);

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
  const directoryOptions = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((project) => {
      const segments = project.path.split('/');
      if (segments.length > 1) {
        set.add(segments.slice(0, -1).join('/'));
      }
    });
    return Array.from(set).sort();
  }, [projects]);

  const searchResults = useMemo(() => {
    if (!search.trim()) {
      return [];
    }
    const keyword = search.trim().toLowerCase();
    return projects.filter(
      (project) =>
        project.path.toLowerCase().includes(keyword) ||
        project.path.split('/').pop()?.toLowerCase().includes(keyword),
    );
  }, [projects, search]);

  const openModal = (type: ModalType) => {
    setModalType(type);
  };

  const closeModal = () => {
    setModalType(null);
    setFocusToken(false);
  };

  const handlePrimaryAction = () => {
    setPrefill((prev) => ({ ...prev, uploadPath: currentPath, uploadFilename: '' }));
    setFocusToken(false);
    openModal('UPLOAD');
  };

  const handleRequestAction = () => {
    setPrefill((prev) => ({ ...prev, requestPath: currentPath }));
    openModal('REQUEST');
  };

  const handleContextAction = (action: ContextAction, node: TreeNode) => {
    const filePath = node.path;
    const { directory, fileName } = splitPath(filePath);
    setContextMenu(null);
    if (action === 'request') {
      setPrefill((prev) => ({ ...prev, requestPath: filePath }));
      openModal('REQUEST');
    } else if (action === 'delete') {
      setPrefill((prev) => ({ ...prev, deletePath: filePath }));
      openModal('DELETE');
    } else if (action === 'edit') {
      setPrefill((prev) => ({ ...prev, uploadPath: directory, uploadFilename: fileName }));
      setFocusToken(true);
      openModal('UPLOAD');
    }
  };

  const handleFileMenuClick = (node: TreeNode, position: { x: number; y: number }) => {
    setContextMenu({ x: position.x, y: position.y, node });
  };

  const handleUploadSuccess = () => {
    loadProjects();
    closeModal();
  };

  const toggleSidebar = () => {
    if (isSidebarOpen) {
      setCachedSidebarWidth(sidebarWidth);
      setSidebarOpen(false);
    } else {
      setSidebarWidth(cachedSidebarWidth);
      setSidebarOpen(true);
    }
  };

  const startResizing = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isSidebarOpen) {
      return;
    }
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      const nextWidth = Math.min(420, Math.max(200, startWidth + delta));
      setSidebarWidth(nextWidth);
      setCachedSidebarWidth(nextWidth);
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  let modalTitle = '';
  let modalContent: JSX.Element | null = null;
  if (modalType === 'UPLOAD') {
    modalTitle = prefill.uploadFilename ? '编辑 / 覆盖 HTML' : '上传 HTML';
    modalContent = (
      <UploadForm
        onUploaded={handleUploadSuccess}
        defaultPath={prefill.uploadPath || currentPath}
        defaultFilename={prefill.uploadFilename}
        availablePaths={directoryOptions}
        autoFocusToken={focusToken}
      />
    );
  } else if (modalType === 'REQUEST') {
    modalTitle = '申请修改 / 删除权限';
    modalContent = <PermissionRequestForm defaultPath={prefill.requestPath || currentPath} />;
  } else if (modalType === 'DELETE') {
    modalTitle = '使用 Token 删除文件';
    modalContent = <DeleteForm defaultPath={prefill.deletePath} />;
  }

  return (
    <div className="workspace">
      <aside
        className={`sidebar ${isSidebarOpen ? '' : 'collapsed'}`}
        style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
      >
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

      {isSidebarOpen && <div className="resizer" onMouseDown={startResizing} />}

      <section className={`canvas ${isSidebarOpen ? '' : 'full'}`}>
        <header className="canvas-header">
          <div className="header-controls">
            <button type="button" className="ghost-icon" onClick={toggleSidebar}>
              ☰
            </button>
            <div>
              <h1>我的画廊</h1>
              <p className="muted">浏览或管理所有托管在 ECS 的 HTML 作品</p>
            </div>
          </div>
          <div className="canvas-actions">
            <input
              type="search"
              placeholder="搜索文件..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="button" className="secondary" onClick={handleRequestAction}>
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
              flatResults={searchResults}
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

      {modalType && modalContent && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <h3>{modalTitle}</h3>
              <button type="button" onClick={closeModal}>
                ✕
              </button>
            </header>
            <div className="drawer-panel">{modalContent}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserHome;
