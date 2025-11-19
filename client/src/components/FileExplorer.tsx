import { MouseEvent as ReactMouseEvent, useEffect, useMemo, useState } from 'react';
import DirectoryTree from './DirectoryTree';
import { TreeNode } from '../types';
import { buildSiteUrl } from '../lib/url';

type Props = {
  tree: TreeNode[];
  onFileMenuClick: (node: TreeNode, position: { x: number; y: number }) => void;
};

const pathExists = (nodes: TreeNode[], segments: string[]) => {
  if (!segments.length) {
    return true;
  }
  let current = nodes;
  for (const segment of segments) {
    const match = current.find((node) => !node.isFile && node.name === segment);
    if (!match) {
      return false;
    }
    current = match.children || [];
  }
  return true;
};

const FileExplorer = ({ tree, onFileMenuClick }: Props) => {
  const [viewMode, setViewMode] = useState<'gallery' | 'tree'>('gallery');
  const [currentPath, setCurrentPath] = useState('');

  const pathSegments = useMemo(() => (currentPath ? currentPath.split('/') : []), [currentPath]);

  const currentItems = useMemo(() => {
    if (!pathSegments.length) {
      return tree;
    }
    let nodes = tree;
    let target: TreeNode | undefined;
    for (const segment of pathSegments) {
      target = nodes.find((node) => !node.isFile && node.name === segment);
      if (!target) {
        return tree;
      }
      nodes = target.children || [];
    }
    return target?.children || [];
  }, [pathSegments, tree]);

  const breadcrumbs = useMemo(() => {
    const crumbs = [{ label: '全部内容', path: '' }];
    if (!pathSegments.length) {
      return crumbs;
    }
    pathSegments.forEach((segment, index) => {
      const path = pathSegments.slice(0, index + 1).join('/');
      crumbs.push({ label: segment, path });
    });
    return crumbs;
  }, [pathSegments]);

  const directories = currentItems.filter((item) => !item.isFile);
  const files = currentItems.filter((item) => item.isFile && item.project);

  const handleMenuClick = (event: ReactMouseEvent<HTMLButtonElement>, node: TreeNode) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    onFileMenuClick(node, { x: rect.right, y: rect.bottom });
  };

  useEffect(() => {
    if (!currentPath) {
      return;
    }
    if (!pathExists(tree, pathSegments)) {
      setCurrentPath('');
    }
  }, [tree, currentPath, pathSegments]);

  return (
    <div className="file-explorer">
      <div className="explorer-header">
        <div>
          <p className="eyebrow">当前托管内容</p>
          <h2>共创 HTML 画廊</h2>
          <p className="muted">
            在这里以文件夹或层级视图探索所有托管的 HTML 作品，点击可在新标签页预览效果。
          </p>
        </div>
        <div className="view-toggle">
          <button
            type="button"
            className={viewMode === 'gallery' ? 'toggle active' : 'toggle'}
            onClick={() => setViewMode('gallery')}
          >
            文件夹
          </button>
          <button
            type="button"
            className={viewMode === 'tree' ? 'toggle active' : 'toggle'}
            onClick={() => setViewMode('tree')}
          >
            目录
          </button>
        </div>
      </div>

      {viewMode === 'tree' ? (
        <div className="tree-view-panel">
          <DirectoryTree nodes={tree} />
        </div>
      ) : (
        <div className="gallery-view-panel">
          <div className="breadcrumbs">
            {breadcrumbs.map((crumb, index) => (
              <button
                type="button"
                key={crumb.path || 'root'}
                onClick={() => setCurrentPath(crumb.path)}
                className={index === breadcrumbs.length - 1 ? 'crumb active' : 'crumb'}
              >
                {crumb.label}
              </button>
            ))}
          </div>

          <div className="folder-grid">
            {directories.map((dir) => (
              <button
                key={dir.path}
                type="button"
                className="folder-card"
                onClick={() => setCurrentPath(dir.path)}
              >
                <span className="folder-icon">📁</span>
                <div>
                  <p className="folder-name">{dir.name}</p>
                  <p className="muted">{dir.children?.length || 0} 个条目</p>
                </div>
              </button>
            ))}
            {directories.length === 0 && (
              <div className="empty-placeholder">该文件夹下暂无子文件夹</div>
            )}
          </div>

          <div className="file-grid">
            {files.map((file) => (
              <div key={file.path} className="file-card">
                <button
                  type="button"
                  aria-label="更多操作"
                  className="file-menu-button"
                  onClick={(event) => handleMenuClick(event, file)}
                >
                  ☰
                </button>
                <div className="file-preview">
                  {file.project?.url ? (
                    <iframe
                      title={file.name}
                      src={buildSiteUrl(file.project.url)}
                      loading="lazy"
                      sandbox="allow-same-origin allow-scripts allow-forms"
                    />
                  ) : (
                    <div className="file-preview-fallback">HTML</div>
                  )}
                </div>
                <div className="file-meta">
                  <div>
                    <p className="file-name" title={file.path}>
                      {file.name}
                    </p>
                    <p className="muted">{file.path}</p>
                  </div>
                  {file.project?.url && (
                    <a className="open-link" href={buildSiteUrl(file.project.url)} target="_blank" rel="noreferrer">
                      预览
                    </a>
                  )}
                </div>
              </div>
            ))}
            {files.length === 0 && (
              <div className="empty-placeholder">该目录暂无 HTML 文件，快来成为第一个创作者！</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileExplorer;
