import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface UserProfile {
    id: number;
    email: string | null;
    username: string;
    credits: number;
    role: string;
    createdAt: string;
}

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

const API_BASE =
    import.meta.env.VITE_API_BASE ||
    (import.meta.env.DEV ? 'http://127.0.0.1:3000/api' : '/api');

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (accessToken: string) => {
        try {
            const resp = await fetch(`${API_BASE}/user/profile`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            if (resp.ok) {
                const data = await resp.json();
                setProfile(data.user);
            }
        } catch (error) {
            console.error('Failed to fetch profile:', error);
        }
    };

    const refreshProfile = async () => {
        if (session?.access_token) {
            await fetchProfile(session.access_token);
        }
    };

    useEffect(() => {
        if (!supabase) {
            setLoading(false);
            return;
        }

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.access_token) {
                fetchProfile(session.access_token);
            }
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                if (session?.access_token) {
                    await fetchProfile(session.access_token);
                } else {
                    setProfile(null);
                }
                setLoading(false);
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        if (supabase) {
            await supabase.auth.signOut();
        }
        setSession(null);
        setUser(null);
        setProfile(null);
    };

    return (
        <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
};
