import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lightbulb, ArrowRight } from 'lucide-react';
import UploadForm from '../components/UploadForm';
import DeleteForm from '../components/DeleteForm';
import FileExplorer from '../components/FileExplorer';
import DirectoryTree from '../components/DirectoryTree';
import ContextMenu, { ContextAction } from '../components/ContextMenu';
import DirectoryContextCard from '../components/DirectoryContextCard';
import AIDock from '../components/AIDock';
import UserGuide from '../components/UserGuide';

import { createDirectory, fetchDirectoryMeta, fetchProjects, saveDirectoryMeta } from '../api';
import { DirectoryMeta, Project, TreeNode } from '../types';

type ModalType = 'UPLOAD' | 'DELETE' | 'PROMPT' | 'FOLDER' | null;

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
  const [directories, setDirectories] = useState<string[]>([]);
  const [directoryMetaMap, setDirectoryMetaMap] = useState<Record<string, DirectoryMeta>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const location = useLocation();
  const navigate = useNavigate();

  // Derived state from URL
  const currentPath = useMemo(() => {
    const path = decodeURIComponent(location.pathname);
    // Remove leading slash
    return path.startsWith('/') ? path.slice(1) : path;
  }, [location.pathname]);

  const handlePathChange = (newPath: string) => {
    if (!newPath) {
      navigate('/');
    } else {
      navigate('/' + newPath);
    }
  };

  const [search, setSearch] = useState('');
  const [modalType, setModalType] = useState<ModalType>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [prefill, setPrefill] = useState({
    uploadPath: '',
    uploadFilename: '',
    deletePath: '',
  });
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [cachedSidebarWidth, setCachedSidebarWidth] = useState(260);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [promptDraft, setPromptDraft] = useState('');
  const [promptDescription, setPromptDescription] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderPrompt, setNewFolderPrompt] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(true);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProjects();
      setProjects(data.projects);
      setTree(data.tree);
      setDirectories(data.directories || []);
      const metas = data.directoryMeta || [];
      const metaMap = metas.reduce<Record<string, DirectoryMeta>>((acc, meta) => {
        acc[meta.path || ''] = meta;
        return acc;
      }, {});
      setDirectoryMetaMap(metaMap);
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

  const breadcrumbs = useMemo(() => {
    const segments = currentPath ? currentPath.split('/') : [];
    const crumbs = [{ label: '全部内容', path: '' }];
    segments.forEach((segment, index) => {
      const path = segments.slice(0, index + 1).join('/');
      crumbs.push({ label: segment, path });
    });
    return crumbs;
  }, [currentPath]);

  const openModal = (type: ModalType) => {
    setModalError(null);
    setModalType(type);
  };

  const closeModal = () => {
    setModalType(null);
  };

  const handlePrimaryAction = () => {
    setPrefill((prev) => ({ ...prev, uploadPath: currentPath, uploadFilename: '' }));
    openModal('UPLOAD');
  };

  const handlePromptAction = () => {
    const meta = directoryMetaMap[currentPath || ''];
    setPromptDraft(meta?.systemPrompt || '');
    setPromptDescription(meta?.description || '');
    openModal('PROMPT');
  };

  const handleCreateFolderAction = () => {
    setNewFolderName('');
    setNewFolderPrompt('');
    setNewFolderDescription('');
    openModal('FOLDER');
  };

  const handleContextAction = (action: ContextAction, node: TreeNode) => {
    const filePath = node.path;
    const { directory, fileName } = splitPath(filePath);
    setContextMenu(null);
    if (action === 'delete') {
      setPrefill((prev) => ({ ...prev, deletePath: filePath }));
      openModal('DELETE');
    } else if (action === 'edit') {
      setPrefill((prev) => ({ ...prev, uploadPath: directory, uploadFilename: fileName }));
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

  const handleDeleteSuccess = () => {
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

  const currentMeta = directoryMetaMap[currentPath || ''];

  useEffect(() => {
    const key = currentPath || '';
    if (directoryMetaMap[key]) {
      return;
    }
    const loadMeta = async () => {
      try {
        const data = await fetchDirectoryMeta(key);
        setDirectoryMetaMap((prev) => ({ ...prev, [key]: data.directory }));
      } catch (err) {
        // ignore
      }
    };
    loadMeta();
  }, [currentPath, directoryMetaMap]);

  const handlePromptSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await saveDirectoryMeta({
        path: currentPath,
        systemPrompt: promptDraft,
        description: promptDescription,
      });
      await loadProjects();
      closeModal();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : '保存失败');
    }
  };

  const handleFolderSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setModalError(null);
    if (!newFolderName.trim()) {
      setModalError('请输入文件夹名称');
      return;
    }
    const nextPath = [currentPath, newFolderName.trim()].filter(Boolean).join('/');
    try {
      await createDirectory({
        path: nextPath,
        systemPrompt: newFolderPrompt,
        description: newFolderDescription,
      });
      await loadProjects();
      handlePathChange(nextPath);
      closeModal();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : '创建失败');
    }
  };

  let modalTitle = '';
  let modalContent: JSX.Element | null = null;
  if (modalType === 'UPLOAD') {
    modalTitle = prefill.uploadFilename ? '编辑 HTML' : '新建 HTML 页面';
    modalContent = (
      <UploadForm
        onUploaded={handleUploadSuccess}
        defaultPath={prefill.uploadPath || currentPath}
        defaultFilename={prefill.uploadFilename}
      />
    );
  } else if (modalType === 'DELETE') {
    modalTitle = '删除文件';
    modalContent = <DeleteForm defaultPath={prefill.deletePath} onDeleted={handleDeleteSuccess} />;
  } else if (modalType === 'PROMPT') {
    modalTitle = '编辑目录 Prompt';
    modalContent = (
      <form className="form-grid" onSubmit={handlePromptSubmit}>
        <div className="input-group">
          <label>System Prompt</label>
          <textarea rows={6} value={promptDraft} onChange={(event) => setPromptDraft(event.target.value)} placeholder="描述这个目录的内容风格，AI将据此生成..." />
        </div>
        <div className="input-group">
          <label>描述</label>
          <input value={promptDescription} onChange={(event) => setPromptDescription(event.target.value)} placeholder="简短描述这个目录" />
        </div>
        {modalError && <p className="status-error">{modalError}</p>}
        <button type="submit" className="primary">
          保存
        </button>
      </form>
    );
  } else if (modalType === 'FOLDER') {
    modalTitle = '新建文件夹';
    modalContent = (
      <form className="form-grid" onSubmit={handleFolderSubmit}>
        <div className="location-badge">
          <span className="badge-icon">📂</span>
          <span className="badge-text">创建于：{currentPath || '根目录'}</span>
        </div>
        <div className="input-group">
          <label>文件夹名称</label>
          <input value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder="输入文件夹名称" autoFocus />
        </div>
        <div className="input-group">
          <label>System Prompt（可选）</label>
          <textarea
            rows={3}
            placeholder="描述这个目录的内容定位..."
            value={newFolderPrompt}
            onChange={(event) => setNewFolderPrompt(event.target.value)}
          />
        </div>
        <div className="input-group">
          <label>描述（可选）</label>
          <input value={newFolderDescription} onChange={(event) => setNewFolderDescription(event.target.value)} placeholder="一句话描述" />
        </div>
        {modalError && <p className="status-error">{modalError}</p>}
        <button type="submit" className="primary">
          创建
        </button>
      </form>
    );
  }

  return (
    <div className="workspace">
      {isSidebarOpen && <div className="sidebar-overlay" onClick={toggleSidebar} />}
      <aside
        className={`sidebar ${isSidebarOpen ? '' : 'collapsed'}`}
        style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
      >
        <div className="sidebar-header">
          <h2>AI 创作集散地</h2>
          <p className="muted">本站托管了用户的HTML代码，打开对应页面分享给其他人</p>
        </div>

        <div className="usage-guide-sidebar">
          <div className="guide-sidebar-header">
            <Lightbulb size={14} />
            <strong>AI 创作流程</strong>
            <button type="button" className="ghost-icon-mini" onClick={() => setShowGuide(!showGuide)}>
              {showGuide ? '−' : '+'}
            </button>
          </div>
          {showGuide && (
            <div className="guide-sidebar-steps">
              <div className="guide-sidebar-step">
                <span className="step-num">1</span>
                <span>浏览灵感</span>
              </div>
              <div className="guide-sidebar-step">
                <span className="step-num">2</span>
                <span>复制 Prompt</span>
              </div>
              <div className="guide-sidebar-step">
                <span className="step-num">3</span>
                <span>跳转 AI 生成</span>
              </div>
              <div className="guide-sidebar-step">
                <span className="step-num">4</span>
                <span>粘贴回来分享</span>
              </div>
            </div>
          )}
        </div>

        <div className="sidebar-section">
          <p className="section-title">目录</p>
          <DirectoryTree nodes={tree} activePath={currentPath} onSelectPath={handlePathChange} />
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
          <button type="button" className="ghost-icon" onClick={toggleSidebar}>
            ☰
          </button>
          <div className="breadcrumbs">
            {breadcrumbs.map((crumb, index) => (
              <button
                key={crumb.path || 'root'}
                type="button"
                className={index === breadcrumbs.length - 1 ? 'crumb active' : 'crumb'}
                onClick={() => handlePathChange(crumb.path)}
              >
                {crumb.label}
              </button>
            ))}
          </div>
          <div className="canvas-actions">
            <input
              type="search"
              placeholder="搜索..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="button" className="secondary" onClick={handleCreateFolderAction}>
              新建文件夹
            </button>
            <button type="button" className="primary" onClick={handlePrimaryAction} id="btn-create-page">
              + 新建页面
            </button>
          </div>
        </header>

        <div className="canvas-body">
          {loading && <p>加载中...</p>}
          {error && <p className="status-error">{error}</p>}
          {!loading && !error && (
            <>
              {currentPath && <DirectoryContextCard path={currentPath} meta={currentMeta} onEdit={handlePromptAction} />}
              <FileExplorer
                tree={tree}
                currentPath={currentPath}
                onPathChange={handlePathChange}
                searchTerm={search}
                flatResults={searchResults}
                onFileMenuClick={handleFileMenuClick}
              />
            </>
          )}
        </div>
      </section>

      <AIDock currentPrompt={currentMeta?.systemPrompt} />

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
            <div className="modal-body">{modalContent}</div>
          </div>
        </div>
      )}
      <UserGuide />
    </div>
  );
};

export default UserHome;
