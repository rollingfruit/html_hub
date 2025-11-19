import { MouseEvent as ReactMouseEvent, useMemo, useState } from 'react';
import { TreeNode } from '../types';
import { buildSiteUrl } from '../lib/url';

type Props = {
  tree: TreeNode[];
  currentPath: string;
  onPathChange: (path: string) => void;
  searchTerm: string;
  onFileMenuClick: (node: TreeNode, position: { x: number; y: number }) => void;
};

const getNodesAtPath = (tree: TreeNode[], segments: string[]) => {
  if (!segments.length) {
    return tree;
  }
  let nodes = tree;
  for (const segment of segments) {
    const match = nodes.find((node) => !node.isFile && node.name === segment);
    if (!match) {
      return tree;
    }
    nodes = match.children || [];
  }
  return nodes;
};

const FileExplorer = ({ tree, currentPath, onPathChange, searchTerm, onFileMenuClick }: Props) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const segments = useMemo(() => (currentPath ? currentPath.split('/') : []), [currentPath]);
  const currentItems = useMemo(() => getNodesAtPath(tree, segments), [tree, segments]);

  const directories = currentItems.filter((node) => !node.isFile);
  const files = currentItems.filter((node) => node.isFile && node.project);
  const filteredFiles = useMemo(() => {
    if (!searchTerm.trim()) {
      return files;
    }
    const keyword = searchTerm.toLowerCase();
    return files.filter((file) => file.name.toLowerCase().includes(keyword) || file.path.toLowerCase().includes(keyword));
  }, [files, searchTerm]);

  const breadcrumbs = useMemo(() => {
    const crumbs = [{ label: '全部内容', path: '' }];
    segments.forEach((segment, index) => {
      const path = segments.slice(0, index + 1).join('/');
      crumbs.push({ label: segment, path });
    });
    return crumbs;
  }, [segments]);

  const handleMenuClick = (event: ReactMouseEvent<HTMLButtonElement>, node: TreeNode) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    onFileMenuClick(node, { x: rect.right, y: rect.bottom });
  };

  return (
    <div className="file-explorer">
      <div className="canvas-toolbar">
        <div className="breadcrumbs">
          {breadcrumbs.map((crumb, index) => (
            <button
              key={crumb.path || 'root'}
              type="button"
              className={index === breadcrumbs.length - 1 ? 'crumb active' : 'crumb'}
              onClick={() => onPathChange(crumb.path)}
            >
              {crumb.label}
            </button>
          ))}
        </div>
        <div className="view-toggle">
          <button
            type="button"
            className={viewMode === 'grid' ? 'toggle active' : 'toggle'}
            onClick={() => setViewMode('grid')}
          >
            网格
          </button>
          <button
            type="button"
            className={viewMode === 'list' ? 'toggle active' : 'toggle'}
            onClick={() => setViewMode('list')}
          >
            列表
          </button>
        </div>
      </div>

      {directories.length > 0 && (
        <div className="directory-chips">
          {directories.map((dir) => (
            <button key={dir.path} type="button" onClick={() => onPathChange(dir.path)}>
              📁 {dir.name}
            </button>
          ))}
        </div>
      )}

      <div className={viewMode === 'grid' ? 'file-grid' : 'file-list'}>
        {filteredFiles.map((file) => (
          <article key={file.path} className={viewMode === 'grid' ? 'file-card grid' : 'file-card list'}>
            <button
              type="button"
              aria-label="更多操作"
              className="file-menu-button"
              onClick={(event) => handleMenuClick(event, file)}
            >
              ⋯
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
            <footer className="file-meta">
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
            </footer>
          </article>
        ))}
        {filteredFiles.length === 0 && (
          <div className="empty-placeholder">未找到匹配的 HTML，试试其它关键词。</div>
        )}
      </div>
    </div>
  );
};

export default FileExplorer;
