import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    lastLng?: number;
    lastLat?: number;
    lastZoom?: number;
    lastFilters?: Record<string, any>;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    setAuth: (user: User, token: string) => void;
    logout: () => void;
    setLoading: (loading: boolean) => void;
    updateUser: (updates: Partial<User>) => void;
    initializeAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: true,

            setAuth: (user, token) => {
                localStorage.setItem('token', token);
                set({ user, token, isAuthenticated: true, isLoading: false });
            },

            logout: () => {
                localStorage.removeItem('token');
                set({ user: null, token: null, isAuthenticated: false, isLoading: false });
            },

            setLoading: (loading) => set({ isLoading: loading }),

            updateUser: (updates) => set((state) => ({
                user: state.user ? { ...state.user, ...updates } : null
            })),

            initializeAuth: () => {
                const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                if (!token) {
                    // Auto-authenticate in development
                    if (process.env.NODE_ENV === 'development') {
                        const mockUser = {
                            id: 'dev-user',
                            email: 'dev@example.com',
                            firstName: 'Dev',
                            lastName: 'User',
                        };
                        const mockToken = 'dev-token';
                        set({ user: mockUser, token: mockToken, isAuthenticated: true, isLoading: false });
                    } else {
                        set({ isLoading: false });
                    }
                }
            },
        }),
        {
            name: 'auth-storage',
            onRehydrateStorage: () => (state) => {
                state?.initializeAuth();
            },
        }
    )
);