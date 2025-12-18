import { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { Navigate, Link } from 'react-router-dom';

interface ApiLog {
    id: number;
    endpoint: string;
    model: string | null;
    cost: number;
    status: string;
    createdAt: string;
}

interface ModelInfo {
    provider: string;
    model: string;
    available: boolean;
}

const API_BASE =
    import.meta.env.VITE_API_BASE ||
    (import.meta.env.DEV ? 'http://127.0.0.1:3000/api' : '/api');

const UserDashboard = () => {
    const { user, profile, loading, signOut, refreshProfile, session } = useAuth();
    const [logs, setLogs] = useState<ApiLog[]>([]);
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [totalApiCalls, setTotalApiCalls] = useState(0);

    useEffect(() => {
        if (session?.access_token) {
            fetchData();
        }
    }, [session]);

    const fetchData = async () => {
        if (!session?.access_token) return;

        try {
            // Fetch profile with recent logs
            const profileResp = await fetch(`${API_BASE}/user/profile`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (profileResp.ok) {
                const data = await profileResp.json();
                setLogs(data.stats?.recentLogs || []);
                setTotalApiCalls(data.stats?.totalApiCalls || 0);
            }

            // Fetch available models
            const modelsResp = await fetch(`${API_BASE}/llm/models`);
            if (modelsResp.ok) {
                const data = await modelsResp.json();
                setModels(data.models || []);
            }
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        }
    };

    if (loading) {
        return (
            <div className="card" style={{ maxWidth: '800px', margin: '2rem auto', textAlign: 'center' }}>
                <p>加载中...</p>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem' }}>
            {/* Header */}
            <div className="card" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ margin: 0 }}>👤 用户中心</h2>
                        <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>
                            {user.email}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <Link to="/" className="btn secondary">返回首页</Link>
                        <button className="btn secondary" onClick={signOut}>退出登录</button>
                    </div>
                </div>
            </div>

            {/* Credits Card */}
            <div className="card" style={{
                marginBottom: '1rem',
                background: 'linear-gradient(135deg, var(--primary-color) 0%, #667eea 100%)',
                color: 'white'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <p style={{ margin: 0, opacity: 0.9, fontSize: '0.875rem' }}>可用积分</p>
                        <p style={{ margin: '0.5rem 0 0', fontSize: '2.5rem', fontWeight: 700 }}>
                            {profile?.credits?.toFixed(4) || '0.0000'}
                        </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <button
                            className="btn"
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                color: 'white',
                                border: '1px solid rgba(255,255,255,0.3)'
                            }}
                            onClick={() => alert('充值功能即将上线，敬请期待！')}
                        >
                            💳 充值积分
                        </button>
                        <p style={{ margin: '0.5rem 0 0', opacity: 0.8, fontSize: '0.75rem' }}>
                            支付宝/微信 即将支持
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div className="card" style={{ textAlign: 'center' }}>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>总 API 调用</p>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', fontWeight: 600 }}>{totalApiCalls}</p>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>可用模型</p>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', fontWeight: 600 }}>
                        {models.filter(m => m.available).length}
                    </p>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>账户角色</p>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', fontWeight: 600 }}>
                        {profile?.role === 'admin' ? '管理员' : '普通用户'}
                    </p>
                </div>
            </div>

            {/* Available Models */}
            <div className="card" style={{ marginBottom: '1rem' }}>
                <h3 style={{ marginTop: 0 }}>🤖 可用模型</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {models.map((m) => (
                        <span
                            key={`${m.provider}-${m.model}`}
                            style={{
                                padding: '0.25rem 0.75rem',
                                borderRadius: '999px',
                                fontSize: '0.75rem',
                                background: m.available ? 'var(--success-bg)' : 'var(--bg-secondary)',
                                color: m.available ? 'var(--success-color)' : 'var(--text-muted)',
                                border: `1px solid ${m.available ? 'var(--success-color)' : 'var(--border-color)'}`,
                            }}
                        >
                            {m.model}
                        </span>
                    ))}
                    {models.length === 0 && (
                        <p style={{ color: 'var(--text-muted)', margin: 0 }}>暂无可用模型</p>
                    )}
                </div>
            </div>

            {/* Recent API Logs */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0 }}>📊 最近调用记录</h3>
                    <button className="btn secondary" onClick={fetchData} style={{ fontSize: '0.875rem' }}>
                        刷新
                    </button>
                </div>
                {logs.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>时间</th>
                                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>模型</th>
                                    <th style={{ textAlign: 'right', padding: '0.5rem' }}>消耗积分</th>
                                    <th style={{ textAlign: 'center', padding: '0.5rem' }}>状态</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>
                                            {formatDate(log.createdAt)}
                                        </td>
                                        <td style={{ padding: '0.5rem' }}>{log.model || log.endpoint}</td>
                                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                            {log.cost.toFixed(6)}
                                        </td>
                                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '0.125rem 0.5rem',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                background: log.status === 'success' ? 'var(--success-bg)' : 'var(--error-bg)',
                                                color: log.status === 'success' ? 'var(--success-color)' : 'var(--error-color)',
                                            }}>
                                                {log.status === 'success' ? '成功' : '失败'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: '2rem 0' }}>
                        暂无调用记录
                    </p>
                )}
            </div>

            {/* SDK Integration Guide */}
            <div className="card" style={{ marginTop: '1rem' }}>
                <h3 style={{ marginTop: 0 }}>🔗 HTML 应用接入</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    在您的 HTML 应用中引入 SDK，即可使用平台的 AI 服务：
                </p>
                <pre style={{
                    background: 'var(--bg-secondary)',
                    padding: '1rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    overflow: 'auto'
                }}>
                    {`<script src="/api/sdk/ai-platform.js"></script>
<script>
  // 初始化 SDK
  AIPlatform.init({ token: 'YOUR_ACCESS_TOKEN' });
  
  // 调用 AI
  const response = await AIPlatform.chat({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: 'Hello!' }]
  });
</script>`}
                </pre>
            </div>
        </div>
    );
};

export default UserDashboard;
