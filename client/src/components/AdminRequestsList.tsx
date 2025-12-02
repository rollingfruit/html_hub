import { useState } from 'react';
import { approveRequest } from '../api';
import { FileRequest } from '../types';

type Props = {
  token: string;
  requests: FileRequest[];
  onRefresh: () => Promise<void>;
};

const AdminRequestsList = ({ token, requests, onRefresh }: Props) => {
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [previewRequest, setPreviewRequest] = useState<FileRequest | null>(null);

  const handleAction = async (requestId: number, action: 'APPROVE' | 'REJECT') => {
    setLoadingId(requestId);
    setMessage(null);
    try {
      await approveRequest(token, { requestId, action });
      setIsError(false);
      setMessage(action === 'APPROVE' ? '操作已执行' : '已拒绝');
      await onRefresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : '操作失败');
    } finally {
      setLoadingId(null);
    }
  };

  if (!requests.length) {
    return <p>暂无申请。</p>;
  }

  return (
    <div className="request-list">
      {previewRequest && (
        <div className="modal-overlay" onClick={() => setPreviewRequest(null)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>代码预览: {previewRequest.projectPath}</h3>
              <button className="close-btn" onClick={() => setPreviewRequest(null)}>×</button>
            </div>
            <div className="modal-body">
              <pre className="code-preview">{previewRequest.pendingContent}</pre>
            </div>
            <div className="modal-footer">
              <button className="secondary" onClick={() => setPreviewRequest(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {requests.map((request) => (
        <div key={request.id} className="request-item">
          <div>
            <strong>{request.projectPath}</strong>
            <p>
              类型：<span className={`tag ${request.requestType === 'DELETE' ? 'tag-danger' : 'tag-info'}`}>{request.requestType}</span>
              {' · '}
              状态：<span className={`tag tag-${request.status.toLowerCase()}`}>{request.status}</span>
            </p>
            {request.reason && <p className="muted">理由：{request.reason}</p>}
            {(request.requesterName || request.requesterEmail) && (
              <p className="muted">
                联系人：{request.requesterName || '未填写'}
                {request.requesterEmail && ` · ${request.requesterEmail}`}
              </p>
            )}
          </div>
          <div className="request-actions">
            {request.status === 'PENDING' && (
              <>
                {request.requestType === 'MODIFY' && request.pendingContent && (
                  <button className="secondary" onClick={() => setPreviewRequest(request)}>
                    预览代码
                  </button>
                )}
                <button
                  className="secondary"
                  disabled={loadingId === request.id}
                  onClick={() => handleAction(request.id, 'REJECT')}
                >
                  拒绝
                </button>
                <button
                  className="primary"
                  disabled={loadingId === request.id}
                  onClick={() => handleAction(request.id, 'APPROVE')}
                >
                  {loadingId === request.id ? '处理中...' : (request.requestType === 'DELETE' ? '确认删除' : '确认覆盖')}
                </button>
              </>
            )}
          </div>
        </div>
      ))}
      {message && <p className={isError ? 'status-error' : 'status-success'}>{message}</p>}
    </div>
  );
};

export default AdminRequestsList;
