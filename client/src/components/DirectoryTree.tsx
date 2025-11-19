import { FC } from 'react';
import { TreeNode } from '../types';
import { buildSiteUrl } from '../lib/url';

type Props = {
  nodes: TreeNode[];
  activePath?: string;
  onSelectPath?: (path: string) => void;
};

const DirectoryTree: FC<Props> = ({ nodes, activePath, onSelectPath }) => {
  if (!nodes.length) {
    return <p className="muted">暂无托管内容</p>;
  }

  return (
    <ul className="tree">
      {nodes.map((node) => (
        <TreeBranch key={node.path} node={node} activePath={activePath} onSelectPath={onSelectPath} />
      ))}
    </ul>
  );
};

type BranchProps = {
  node: TreeNode;
  activePath?: string;
  onSelectPath?: (path: string) => void;
};

const TreeBranch: FC<BranchProps> = ({ node, activePath, onSelectPath }) => {
  const isActive = activePath === node.path;
  const handleClick = () => {
    if (onSelectPath) {
      onSelectPath(node.path);
    }
  };

  return (
    <li>
      <div className={isActive ? 'tree-row active' : 'tree-row'}>
        <span>{node.isFile ? '📄' : '📁'}</span>
        {node.isFile && node.project ? (
          <a href={buildSiteUrl(node.project.url)} target="_blank" rel="noreferrer">
            {node.name}
          </a>
        ) : (
          <button type="button" className="tree-folder" onClick={handleClick}>
            {node.name}
          </button>
        )}
      </div>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TreeBranch
              key={child.path}
              node={child}
              activePath={activePath}
              onSelectPath={onSelectPath}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export default DirectoryTree;
