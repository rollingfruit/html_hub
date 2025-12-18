import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthContext';
import { Navigate } from 'react-router-dom';

const LoginPage = () => {
    const { session, loading } = useAuth();

    if (loading) {
        return (
            <div className="card" style={{ maxWidth: '400px', margin: '2rem auto', textAlign: 'center' }}>
                <p>加载中...</p>
            </div>
        );
    }

    if (session) {
        return <Navigate to="/dashboard" replace />;
    }

    if (!supabase) {
        return (
            <div className="card" style={{ maxWidth: '500px', margin: '2rem auto' }}>
                <h2>⚠️ 认证服务未配置</h2>
                <p style={{ color: 'var(--text-muted)' }}>
                    请在 <code>.env</code> 文件中配置 Supabase:
                </p>
                <pre style={{
                    background: 'var(--bg-secondary)',
                    padding: '1rem',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    overflow: 'auto'
                }}>
                    {`VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key`}
                </pre>
            </div>
        );
    }

    return (
        <div className="card" style={{ maxWidth: '400px', margin: '2rem auto' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>🔐 登录 / 注册</h2>
            <Auth
                supabaseClient={supabase}
                appearance={{
                    theme: ThemeSupa,
                    variables: {
                        default: {
                            colors: {
                                brand: 'var(--primary-color)',
                                brandAccent: 'var(--primary-hover)',
                            },
                        },
                    },
                }}
                providers={[]}
                localization={{
                    variables: {
                        sign_in: {
                            email_label: '邮箱',
                            password_label: '密码',
                            email_input_placeholder: '请输入邮箱',
                            password_input_placeholder: '请输入密码',
                            button_label: '登录',
                            loading_button_label: '登录中...',
                            link_text: '已有账号？登录',
                        },
                        sign_up: {
                            email_label: '邮箱',
                            password_label: '密码',
                            email_input_placeholder: '请输入邮箱',
                            password_input_placeholder: '设置密码（至少6位）',
                            button_label: '注册',
                            loading_button_label: '注册中...',
                            link_text: '没有账号？注册',
                        },
                        forgotten_password: {
                            email_label: '邮箱',
                            password_label: '密码',
                            email_input_placeholder: '请输入邮箱',
                            button_label: '发送重置链接',
                            loading_button_label: '发送中...',
                            link_text: '忘记密码？',
                        },
                    },
                }}
            />
            <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                fontSize: '0.875rem',
                color: 'var(--text-muted)'
            }}>
                <p style={{ margin: 0 }}>
                    💡 注册后可获得平台积分，用于调用 AI 服务。
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
