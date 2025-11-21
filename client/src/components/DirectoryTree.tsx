import { FC, useEffect, useState } from 'react';
import { Folder, FolderOpen, FileCode } from 'lucide-react';
import { TreeNode } from '../types';
import { buildSiteUrl } from '../lib/url';

type Props = {
  nodes: TreeNode[];
  activePath?: string;
  onSelectPath?: (path: string) => void;
};

type ExpandedMap = Record<string, boolean>;

const DirectoryTree: FC<Props> = ({ nodes, activePath, onSelectPath }) => {
  const [expanded, setExpanded] = useState<ExpandedMap>({});

  useEffect(() => {
    if (!activePath) {
      return;
    }
    const segments = activePath.split('/');
    if (segments.length <= 1) {
      return;
    }
    setExpanded((prev) => {
      const next = { ...prev };
      segments.slice(0, -1).forEach((_, index) => {
        const path = segments.slice(0, index + 1).join('/');
        next[path] = true;
      });
      return next;
    });
  }, [activePath]);

  const toggleFolder = (path: string) => {
    setExpanded((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  if (!nodes.length) {
    return <p className="muted">暂无托管内容</p>;
  }

  return (
    <ul className="tree">
      {nodes.map((node) => (
        <TreeBranch
          key={node.path}
          node={node}
          activePath={activePath}
          expanded={expanded}
          onToggle={toggleFolder}
          onSelectPath={onSelectPath}
        />
      ))}
    </ul>
  );
};

type BranchProps = {
  node: TreeNode;
  activePath?: string;
  expanded: ExpandedMap;
  onToggle: (path: string) => void;
  onSelectPath?: (path: string) => void;
};

const TreeBranch: FC<BranchProps> = ({ node, activePath, expanded, onToggle, onSelectPath }) => {
  const isActive = activePath === node.path;
  const isFolder = !node.isFile;
  const isExpanded = isFolder ? expanded[node.path] : false;

  const handleFolderClick = () => {
    onToggle(node.path);
    onSelectPath?.(node.path);
  };

  const handleFileClick = () => {
    onSelectPath?.(node.path);
  };

  return (
    <li>
      <div className={isActive ? 'tree-row active' : 'tree-row'}>
        <span className="tree-icon">
          {isFolder ? (
            isExpanded ? (
              <FolderOpen size={16} strokeWidth={2} />
            ) : (
              <Folder size={16} strokeWidth={2} />
            )
          ) : (
            <FileCode size={16} strokeWidth={2} />
          )}
        </span>
        {isFolder ? (
          <button type="button" className="tree-folder" onClick={handleFolderClick}>
            {node.name}
          </button>
        ) : node.project ? (
          <a href={buildSiteUrl(node.project.url)} target="_blank" rel="noreferrer" onClick={handleFileClick}>
            {node.name}
          </a>
        ) : (
          <button type="button" className="tree-folder" onClick={handleFileClick}>
            {node.name}
          </button>
        )}
      </div>
      {isFolder && isExpanded && node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TreeBranch
              key={child.path}
              node={child}
              activePath={activePath}
              expanded={expanded}
              onToggle={onToggle}
              onSelectPath={onSelectPath}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export default DirectoryTree;
