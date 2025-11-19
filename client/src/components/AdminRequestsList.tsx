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

  const handleAction = async (requestId: number, action: 'APPROVE' | 'REJECT') => {
    setLoadingId(requestId);
    setMessage(null);
    try {
      const result = await approveRequest(token, { requestId, action });
      setIsError(false);
      setMessage(action === 'APPROVE' ? `Token: ${result.token}` : '已拒绝');
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
      {requests.map((request) => (
        <div key={request.id} className="request-item">
          <div>
            <strong>{request.projectPath}</strong>
            <p>
              类型：{request.requestType} · 状态：{request.status}
              {request.accessToken && request.status === 'APPROVED' && ` · Token: ${request.accessToken}`}
            </p>
          </div>
          <div className="request-actions">
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
              {loadingId === request.id ? '处理中...' : '通过'}
            </button>
          </div>
        </div>
      ))}
      {message && <p className={isError ? 'status-error' : 'status-success'}>{message}</p>}
    </div>
  );
};

export default AdminRequestsList;
