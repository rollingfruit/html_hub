import { MouseEvent as ReactMouseEvent, useMemo, useState } from 'react';
import { FileCode, FileImage, FileText, File } from 'lucide-react';
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

const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
};

const isImageFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  return ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico'].includes(ext);
};

const isCodeFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  return ['html', 'htm', 'css', 'js', 'jsx', 'ts', 'tsx', 'json'].includes(ext);
};

const isTextFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  return ['txt', 'md'].includes(ext);
};

const FileTypeIcon = ({ filename }: { filename: string }) => {
  if (isImageFile(filename)) {
    return <FileImage size={18} strokeWidth={2} className="file-type-icon" />;
  }
  if (isCodeFile(filename)) {
    return <FileCode size={18} strokeWidth={2} className="file-type-icon" />;
  }
  if (isTextFile(filename)) {
    return <FileText size={18} strokeWidth={2} className="file-type-icon" />;
  }
  return <File size={18} strokeWidth={2} className="file-type-icon" />;
};

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
  // 默认使用网格视图，更像应用商店
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
      <div className="explorer-toolbar">
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
        {isSearchMode && (
          <p className="search-result-hint">
            找到 {itemsToRender.length} 个匹配
          </p>
        )}
      </div>

      {!isSearchMode && directories.length > 0 && (
        <div className="directory-chips-wrapper">
          <div className="directory-chips">
            {directories.map((dir) => (
              <button key={dir.path} type="button" className="folder-chip" onClick={() => onPathChange(dir.path)}>
                <div className="chip-header">
                  <span>📁 {dir.name}</span>
                  <span className="muted">{dir.children?.length || 0} 项</span>
                </div>
                {dir.meta?.systemPrompt && <p className="chip-prompt">{dir.meta.systemPrompt}</p>}
                {dir.meta?.description && <p className="chip-desc">{dir.meta.description}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={viewMode === 'grid' ? 'file-grid' : 'file-list'}>
        {itemsToRender.map((item) => {
          const isImage = isImageFile(item.name);
          const shouldShowIframe = !isImage && isCodeFile(item.name);

          return (
            <article
              key={item.key}
              className={viewMode === 'grid' ? 'file-card grid' : 'file-card list'}
              onClick={() => item.url && window.open(buildSiteUrl(item.url), '_blank', 'noopener,noreferrer')}
              style={{ cursor: item.url ? 'pointer' : 'default' }}
            >
              <div className="file-preview">
                {isImage && item.url ? (
                  <img
                    src={buildSiteUrl(item.url)}
                    alt={item.name}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : shouldShowIframe && item.url ? (
                  <iframe
                    title={item.name}
                    src={buildSiteUrl(item.url)}
                    loading="lazy"
                    sandbox="allow-same-origin allow-scripts allow-forms"
                  />
                ) : (
                  <div className="file-preview-fallback">
                    <FileTypeIcon filename={item.name} />
                    <span className="file-ext">{getFileExtension(item.name).toUpperCase()}</span>
                  </div>
                )}
              </div>
              <footer className="file-meta">
                <p className="file-name" title={item.path}>
                  <FileTypeIcon filename={item.name} />
                  <HighlightedText text={item.name} highlight={searchTerm} />
                </p>
                <button
                  type="button"
                  aria-label="更多操作"
                  className="file-menu-button-footer"
                  onClick={(event) => {
                    event.stopPropagation(); // 阻止事件冒泡，避免触发卡片点击
                    handleMenuClick(event, item);
                  }}
                >
                  ⋯
                </button>
              </footer>
            </article>
          );
        })}
        {itemsToRender.length === 0 && !isSearchMode && directories.length === 0 && (
          <div className="empty-placeholder">
            <p>此目录为空</p>
            <p className="muted">点击右上角"+ 新建页面"开始创作</p>
          </div>
        )}
        {itemsToRender.length === 0 && isSearchMode && (
          <div className="empty-placeholder">未找到匹配的 HTML</div>
        )}
      </div>
    </div>
  );
};

export default FileExplorer;
