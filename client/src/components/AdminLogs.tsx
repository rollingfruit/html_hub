import { useEffect, useState } from 'react';
import { fetchLogs } from '../api';

type Log = {
    id: number;
    action: string;
    targetPath: string;
    operator: string;
    details: string | null;
    createdAt: string;
};

type Props = {
    token: string;
};

const AdminLogs = ({ token }: Props) => {
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const loadLogs = async (p: number) => {
        setLoading(true);
        try {
            const data = await fetchLogs(token, p);
            setLogs(data.logs);
            setPage(data.page);
            setTotalPages(data.totalPages);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLogs(1);
    }, [token]);

    return (
        <section className="card admin-logs">
            <header className="admin-manager-header">
                <div>
                    <h2>操作日志</h2>
                    <p className="muted">查看系统操作记录</p>
                </div>
                <button className="secondary" onClick={() => loadLogs(page)} disabled={loading}>
                    刷新
                </button>
            </header>

            <div className="table-container">
                <table className="logs-table">
                    <thead>
                        <tr>
                            <th>时间</th>
                            <th>操作人</th>
                            <th>动作</th>
                            <th>目标路径</th>
                            <th>详情</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((log) => (
                            <tr key={log.id}>
                                <td>{new Date(log.createdAt).toLocaleString()}</td>
                                <td>{log.operator}</td>
                                <td>
                                    <span className={`badge badge-${log.action.toLowerCase()}`}>{log.action}</span>
                                </td>
                                <td className="path-cell" title={log.targetPath}>
                                    {log.targetPath}
                                </td>
                                <td className="details-cell" title={log.details || ''}>
                                    {log.details || '-'}
                                </td>
                            </tr>
                        ))}
                        {logs.length === 0 && !loading && (
                            <tr>
                                <td colSpan={5} className="text-center">
                                    暂无日志
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="pagination">
                <button disabled={page <= 1} onClick={() => loadLogs(page - 1)}>
                    上一页
                </button>
                <span>
                    {page} / {totalPages || 1}
                </span>
                <button disabled={page >= totalPages} onClick={() => loadLogs(page + 1)}>
                    下一页
                </button>
            </div>

            <style>{`
        .logs-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
        }
        .logs-table th,
        .logs-table td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid var(--border-color);
        }
        .logs-table th {
          background: var(--bg-secondary);
          font-weight: 600;
        }
        .path-cell {
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-family: monospace;
        }
        .details-cell {
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text-muted);
        }
        .badge {
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .badge-upload { background: #e6f4ea; color: #1e8e3e; }
        .badge-modify { background: #e8f0fe; color: #1967d2; }
        .badge-delete { background: #fce8e6; color: #c5221f; }
        .badge-move { background: #fef7e0; color: #f9ab00; }
        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 1rem;
          margin-top: 1rem;
        }
      `}</style>
        </section>
    );
};

export default AdminLogs;
