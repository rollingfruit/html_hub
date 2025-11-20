import { MouseEvent as ReactMouseEvent, useMemo, useState } from 'react';
import { Project, TreeNode } from '../types';
import { buildSiteUrl } from '../lib/url';

type Props = {
  tree: TreeNode[];
  currentPath: string;
  onPathChange: (path: string) => void;
  searchTerm: string;
  flatResults?: Project[];
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

type FileItem = {
  key: string;
  name: string;
  path: string;
  url?: string;
  node?: TreeNode;
  project?: Project;
};

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const HighlightedText = ({ text, highlight }: { text: string; highlight: string }) => {
  if (!highlight) {
    return <>{text}</>;
  }
  const regex = new RegExp(escapeRegExp(highlight), 'gi');
  const parts = text.split(regex);
  const matches = text.match(regex);

  return (
    <>
      {parts.map((part, index) => (
        <span key={`part-${index}`}>
          {part}
          {matches && matches[index] && (
            <span className="highlight" key={`match-${index}`}>
              {matches[index]}
            </span>
          )}
        </span>
      ))}
    </>
  );
};

const FileExplorer = ({
  tree,
  currentPath,
  onPathChange,
  searchTerm,
  flatResults = [],
  onFileMenuClick,
}: Props) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const segments = useMemo(() => (currentPath ? currentPath.split('/') : []), [currentPath]);
  const currentItems = useMemo(() => getNodesAtPath(tree, segments), [tree, segments]);

  const directories = currentItems.filter((node) => !node.isFile);
  const files = currentItems.filter((node) => node.isFile && node.project);
  const normalFileItems: FileItem[] = useMemo(
    () =>
      files.map((node) => ({
        key: node.path,
        name: node.name,
        path: node.path,
        url: node.project?.url,
        node,
      })),
    [files],
  );
  const isSearchMode = Boolean(searchTerm.trim());
  const searchItems: FileItem[] = useMemo(() => {
    if (!isSearchMode) {
      return [];
    }
    const keyword = searchTerm.toLowerCase();
    return flatResults
      .filter(
        (project) =>
          project.path.toLowerCase().includes(keyword) ||
          project.path.split('/').pop()?.toLowerCase().includes(keyword),
      )
      .map((project) => {
        const name = project.path.split('/').pop() || project.path;
        return {
          key: project.path,
          name,
          path: project.path,
          url: project.url,
          project,
        };
      });
  }, [flatResults, isSearchMode, searchTerm]);

  const breadcrumbs = useMemo(() => {
    const crumbs = [{ label: '全部内容', path: '' }];
    segments.forEach((segment, index) => {
      const path = segments.slice(0, index + 1).join('/');
      crumbs.push({ label: segment, path });
    });
    return crumbs;
  }, [segments]);

  const handleMenuClick = (event: ReactMouseEvent<HTMLButtonElement>, item: FileItem) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    let targetNode: TreeNode;
    if (item.node) {
      targetNode = item.node;
    } else {
      targetNode = {
        name: item.name,
        path: item.path,
        isFile: true,
        project: item.project
          ? {
              ...item.project,
            }
          : undefined,
        children: [],
      };
    }
    onFileMenuClick(targetNode, { x: rect.right, y: rect.bottom });
  };

  const itemsToRender = isSearchMode ? searchItems : normalFileItems;

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

      {!isSearchMode && directories.length > 0 && (
        <div className="directory-chips">
          {directories.map((dir) => (
            <button key={dir.path} type="button" className="folder-chip" onClick={() => onPathChange(dir.path)}>
              <div className="chip-header">
                <span>📁 {dir.name}</span>
                <span className="muted">{dir.children?.length || 0} 个文件</span>
              </div>
              {dir.meta?.systemPrompt && <p className="chip-prompt">{dir.meta.systemPrompt}</p>}
              {!dir.meta?.systemPrompt && <p className="chip-prompt empty">添加 System Prompt 帮助创作者</p>}
            </button>
          ))}
        </div>
      )}

      {isSearchMode && (
        <p className="muted">
          搜索结果：{itemsToRender.length} 个匹配
          {itemsToRender.length === 0 && '，尝试更短的关键字'}
        </p>
      )}

      <div className={viewMode === 'grid' ? 'file-grid' : 'file-list'}>
        {itemsToRender.map((item) => (
          <article key={item.key} className={viewMode === 'grid' ? 'file-card grid' : 'file-card list'}>
            <button
              type="button"
              aria-label="更多操作"
              className="file-menu-button"
              onClick={(event) => handleMenuClick(event, item)}
            >
              ⋯
            </button>
            <div className="file-preview">
              {item.url ? (
                <iframe
                  title={item.name}
                  src={buildSiteUrl(item.url)}
                  loading="lazy"
                  sandbox="allow-same-origin allow-scripts allow-forms"
                />
              ) : (
                <div className="file-preview-fallback">HTML</div>
              )}
            </div>
            <footer className="file-meta">
              <div>
                <p className="file-name" title={item.path}>
                  <HighlightedText text={item.name} highlight={searchTerm} />
                </p>
                <p className="muted">
                  <HighlightedText text={item.path} highlight={searchTerm} />
                </p>
              </div>
              {item.url && (
                <a className="open-link" href={buildSiteUrl(item.url)} target="_blank" rel="noreferrer">
                  预览
                </a>
              )}
            </footer>
          </article>
        ))}
        {itemsToRender.length === 0 && (
          <div className="empty-placeholder">未找到匹配的 HTML，试试其它关键词。</div>
        )}
      </div>
    </div>
  );
};

export default FileExplorer;
