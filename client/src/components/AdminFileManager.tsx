import { useCallback, useEffect, useMemo, useState } from 'react';
import FileExplorer from './FileExplorer';
import UploadForm from './UploadForm';
import DeleteForm from './DeleteForm';
import { fetchProjects, moveFile, createDirectory } from '../api';
import { Project, TreeNode } from '../types';
import { DndContext, DragEndEvent, useDroppable, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { DroppableFolder } from './FileExplorer';

type Props = {
  token: string;
};

type ContextMenuState = {
  node: TreeNode;
  x: number;
  y: number;
};

const splitPath = (targetPath: string) => {
  const parts = targetPath.split('/');
  const fileName = parts.pop() || '';
  return {
    directory: parts.join('/'),
    fileName,
  };
};

const AdminFileManager = ({ token }: Props) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const [modalType, setModalType] = useState<'UPLOAD' | 'DELETE' | 'NEW_FOLDER' | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [prefill, setPrefill] = useState({
    uploadPath: '',
    uploadFilename: '',
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

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    const handleClose = () => setContextMenu(null);
    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
    };
  }, [contextMenu]);

  const breadcrumbs = useMemo(() => {
    const segments = currentPath ? currentPath.split('/') : [];
    const crumbs = [{ label: '全部', path: '' }];
    segments.forEach((segment, index) => {
      const pathValue = segments.slice(0, index + 1).join('/');
      crumbs.push({ label: segment, path: pathValue });
    });
    return crumbs;
  }, [currentPath]);

  const searchResults = useMemo(() => {
    if (!search.trim()) {
      return [];
    }
    const keyword = search.toLowerCase();
    return projects.filter(
      (project) =>
        project.path.toLowerCase().includes(keyword) ||
        project.path.split('/').pop()?.toLowerCase().includes(keyword),
    );
  }, [projects, search]);

  const handleFileMenuClick = (node: TreeNode, position: { x: number; y: number }) => {
    setContextMenu({ node, x: position.x, y: position.y });
  };

  const handleContextAction = (action: 'edit' | 'delete') => {
    if (!contextMenu) {
      return;
    }
    const targetPath = contextMenu.node.path;
    setContextMenu(null);
    if (action === 'edit') {
      const { directory, fileName } = splitPath(targetPath);
      setPrefill({ uploadPath: directory, uploadFilename: fileName, deletePath: '' });
      setModalType('UPLOAD');
    } else {
      setPrefill({ uploadPath: '', uploadFilename: '', deletePath: targetPath });
      setModalType('DELETE');
    }
  };

  const handleNewFile = () => {
    setPrefill({ uploadPath: currentPath, uploadFilename: '', deletePath: '' });
    setModalType('UPLOAD');
  };

  const handleNewFolder = () => {
    setNewFolderName('');
    setModalType('NEW_FOLDER');
  };

  const createNewFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createDirectory({
        path: currentPath ? `${currentPath}/${newFolderName}` : newFolderName,
        systemPrompt: '',
        description: '',
      });
      loadProjects();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  };

  const closeModal = () => setModalType(null);

  const handleUploadSuccess = () => {
    loadProjects();
    closeModal();
  };

  const handleDeleteSuccess = () => {
    loadProjects();
    closeModal();
  };

  const handleMove = async (sourcePath: string, targetPath: string) => {
    const { fileName } = splitPath(sourcePath);
    const newPath = targetPath ? `${targetPath}/${fileName}` : fileName;

    try {
      await moveFile({ oldPath: sourcePath, newPath, adminToken: token });
      loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : '移动失败');
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const sourcePath = active.id as string;
    const targetPath = over.id as string;

    if (sourcePath !== targetPath) {
      if (targetPath.startsWith(sourcePath + '/')) return;
      handleMove(sourcePath, targetPath);
    }
  };

  const modalTitle =
    modalType === 'UPLOAD'
      ? prefill.uploadFilename
        ? '编辑 HTML'
        : '新建 HTML 页面'
      : modalType === 'NEW_FOLDER'
        ? '新建文件夹'
        : '删除文件';

  const DroppableBreadcrumb = ({ path, children }: { path: string; children: React.ReactNode }) => {
    const { setNodeRef, isOver } = useDroppable({
      id: path,
      data: { type: 'folder', path },
    });

    const style = {
      outline: isOver ? '2px dashed var(--primary-color)' : undefined,
      borderRadius: '4px',
    };

    return (
      <div ref={setNodeRef} style={style} className="crumb-wrapper">
        {children}
      </div>
    );
  };

  return (
    <section className="card admin-manager">
      <header className="admin-manager-header">
        <div>
          <h2>文件仓管理</h2>
          <p className="muted">管理员可在此直接创建 / 编辑 / 删除 HTML</p>
        </div>
        <div className="admin-manager-actions">
          <input
            type="search"
            placeholder="搜索路径..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button className="secondary" onClick={loadProjects} disabled={loading}>
            {loading ? '刷新中...' : '刷新'}
          </button>
          <button className="secondary" onClick={handleNewFolder}>
            + 新建文件夹
          </button>
          <button className="primary" onClick={handleNewFile}>
            + 新建页面
          </button>
        </div>
      </header>

      <div className="admin-manager-breadcrumbs">
        {breadcrumbs.map((crumb, index) => (
          <DroppableBreadcrumb key={crumb.path || 'root'} path={crumb.path}>
            <button
              type="button"
              className={index === breadcrumbs.length - 1 ? 'crumb active' : 'crumb'}
              onClick={() => setCurrentPath(crumb.path)}
            >
              {crumb.label}
            </button>
          </DroppableBreadcrumb>
        ))}
      </div>

      {error && <p className="status-error">{error}</p>}
      {loading && !error && <p className="muted">加载中...</p>}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <FileExplorer
          tree={tree}
          currentPath={currentPath}
          onPathChange={setCurrentPath}
          searchTerm={search}
          flatResults={searchResults}
          onFileMenuClick={handleFileMenuClick}
          enableDrag={true}
          onMove={handleMove}
        />
        <DragOverlay />
      </DndContext>

      {contextMenu && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <p className="context-title">{contextMenu.node.path}</p>
          <button type="button" onClick={() => handleContextAction('edit')}>
            管理员直接编辑
          </button>
          <button type="button" onClick={() => handleContextAction('delete')}>
            管理员直接删除
          </button>
        </div>
      )}

      {modalType && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <h3>{modalTitle}</h3>
              <button type="button" onClick={closeModal}>
                ✕
              </button>
            </header>
            <div className="modal-body">
              {modalType === 'UPLOAD' ? (
                <UploadForm
                  onUploaded={handleUploadSuccess}
                  defaultPath={prefill.uploadPath || currentPath}
                  defaultFilename={prefill.uploadFilename}
                  adminToken={token}
                />
              ) : modalType === 'NEW_FOLDER' ? (
                <div className="form-group">
                  <label>文件夹名称</label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="输入文件夹名称"
                    autoFocus
                  />
                  <div className="form-actions" style={{ marginTop: '1rem' }}>
                    <button className="primary" onClick={createNewFolder}>
                      创建
                    </button>
                  </div>
                </div>
              ) : (
                <DeleteForm defaultPath={prefill.deletePath} adminToken={token} onDeleted={handleDeleteSuccess} />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminFileManager;
