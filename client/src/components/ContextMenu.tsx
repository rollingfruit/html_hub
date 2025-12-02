import { useEffect } from 'react';
import { TreeNode } from '../types';

export type ContextAction = 'request' | 'delete' | 'edit';

type Props = {
  x: number;
  y: number;
  node: TreeNode;
  onSelect: (action: ContextAction, node: TreeNode) => void;
  onClose: () => void;
};

const ContextMenu = ({ x, y, node, onSelect, onClose }: Props) => {
  useEffect(() => {
    const handleGlobalClick = () => onClose();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('contextmenu', handleGlobalClick);
    window.addEventListener('keyup', handleKey);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('contextmenu', handleGlobalClick);
      window.removeEventListener('keyup', handleKey);
    };
  }, [onClose]);

  const handleSelect = (action: ContextAction) => {
    onSelect(action, node);
    onClose();
  };

  return (
    <div className="context-menu" style={{ top: y, left: x }}>
      <p className="context-title">{node.path}</p>
      <button type="button" onClick={() => handleSelect('edit')}>
        修改文件
      </button>
      <button type="button" onClick={() => handleSelect('delete')}>
        删除文件
      </button>
    </div>
  );
};

export default ContextMenu;
