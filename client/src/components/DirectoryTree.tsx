import { FC } from 'react';
import { TreeNode } from '../types';
import { buildSiteUrl } from '../lib/url';

type Props = {
  nodes: TreeNode[];
};

const DirectoryTree: FC<Props> = ({ nodes }) => {
  if (!nodes.length) {
    return <p>暂无托管内容，快来上传第一个 HTML 吧！</p>;
  }

  return (
    <ul className="tree">
      {nodes.map((node) => (
        <TreeBranch key={node.path} node={node} />
      ))}
    </ul>
  );
};

const TreeBranch: FC<{ node: TreeNode }> = ({ node }) => (
  <li>
    <div className="tree-row">
      <span>{node.isFile ? '📄' : '📁'}</span>
      {node.isFile && node.project ? (
        <a href={buildSiteUrl(node.project.url)} target="_blank" rel="noreferrer">
          {node.name}
        </a>
      ) : (
        <strong>{node.name}</strong>
      )}
    </div>
    {node.children.length > 0 && (
      <ul>
        {node.children.map((child) => (
          <TreeBranch key={child.path} node={child} />
        ))}
      </ul>
    )}
  </li>
);

export default DirectoryTree;
