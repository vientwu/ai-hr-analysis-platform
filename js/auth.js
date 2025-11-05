// 认证管理模块
// 处理用户登录、注册、登出等认证相关功能

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.authListeners = [];
        this.isProcessingAuthChange = false;
        this.processingUsers = new Set(); // 防止重复处理同一用户 // 防止循环调用的标志
        this.init();
    }

    // 初始化认证状态
    async init() {
        try {
            // 等待Auth初始化
            if (typeof window.Auth === 'undefined') {
                // 等待Auth加载
                await new Promise(resolve => {
                    const checkAuth = () => {
                        if (typeof window.Auth !== 'undefined') {
                            resolve();
                        } else {
                            setTimeout(checkAuth, 100);
                        }
                    };
                    checkAuth();
                });
            }

            // 初始化Auth
            window.Auth.initialize();
            
            // 获取当前用户
            this.currentUser = window.Auth.getUser();
            this.notifyAuthListeners('INITIAL_SESSION', { user: this.currentUser });

            // 监听来自Supabase封装的全局事件，保持与AuthManager的状态同步
            // 注：supabase.js 会在认证状态变化时派发 auth-changed 事件
            if (typeof window !== 'undefined') {
                window.addEventListener('auth-changed', (e) => {
                    // 防止循环调用
                    if (this.isProcessingAuthChange) {
                        return;
                    }
                    
                    const user = e.detail?.user || null;
                    try {
                        this.isProcessingAuthChange = true;
                        
                        if (user) {
                            // 将 Supabase 的 user 映射到我们的用户系统
                            this.handleUserSession(user);
                        } else {
                            this.handleSignOut();
                        }
                    } catch (err) {
                        console.error('处理全局认证事件失败:', err);
                    } finally {
                        this.isProcessingAuthChange = false;
                    }
                }, { passive: true });
            }
        } catch (error) {
            console.error('认证初始化失败:', error);
            
            // 使用全局错误处理器处理初始化错误
            if (window.ErrorHandler) {
                window.ErrorHandler.handleSystemError(error, '认证系统初始化失败');
            }
        }
    }

    // 处理用户会话
    async handleUserSession(authUser) {
        try {
            if (!authUser) {
                this.currentUser = null;
                return;
            }
            
            // 防止重复处理同一用户，但如果currentUser为空，仍需要处理
            if (this.processingUsers.has(authUser.id)) {
                console.log('用户会话正在处理中，跳过重复请求:', authUser.id);
                // 如果currentUser为空，等待一下再检查
                if (!this.currentUser) {
                    setTimeout(() => {
                        if (!this.currentUser) {
                            console.log('currentUser仍为空，重新处理用户会话');
                            this.processingUsers.delete(authUser.id);
                            this.handleUserSession(authUser);
                        }
                    }, 100);
                }
                return;
            }
            
            this.processingUsers.add(authUser.id);
            
            const client = window.Auth?.getClient?.();
            if (!client) {
                console.error('Supabase 客户端未初始化，无法处理用户会话');
                this.processingUsers.delete(authUser.id);
                return;
            }
            // 检查用户是否在我们的数据库中存在
            let userData = null;
            let error = null;
            
            // 添加重试机制
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const result = await client
                        .from('users')
                        .select('*')
                        .eq('auth_id', authUser.id)
                        .single();
                    
                    userData = result.data;
                    error = result.error;
                    break; // 成功则跳出重试循环
                } catch (err) {
                    console.warn(`查询用户数据失败 (尝试 ${attempt}/3):`, err);
                    error = err;
                    
                    if (attempt < 3) {
                        // 等待一段时间后重试
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    }
                }
            }

            if (error && error.code !== 'PGRST116') { // PGRST116 = 没有找到记录
                console.error('查询用户数据失败 (所有重试都失败):', error);
                // 不要直接返回，而是使用本地缓存的用户信息
                if (authUser) {
                    this.currentUser = {
                        auth_id: authUser.id,
                        email: authUser.email,
                        full_name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
                        avatar_url: authUser.user_metadata?.avatar_url,
                        last_login_at: new Date().toISOString(),
                        _isOfflineMode: true // 标记为离线模式
                    };
                    console.log('使用离线模式的用户信息:', this.currentUser);
                    this.notifyAuthListeners('SIGNED_IN', { user: this.currentUser });
                }
                return;
            }

            // 如果用户不存在，创建用户记录
            if (!userData) {
                const newUser = {
                    auth_id: authUser.id,
                    email: authUser.email,
                    full_name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
                    avatar_url: authUser.user_metadata?.avatar_url,
                    last_login_at: new Date().toISOString()
                };

                const { data: createdUser, error: createError } = await client
                    .from('users')
                    .insert([newUser])
                    .select()
                    .single();

                if (createError) {
                    // 如果是重复键错误（用户已存在），重新查询用户数据
                    if (createError.code === '23505') {
                        console.log('用户记录已存在，重新查询...');
                        const { data: existingUser, error: queryError } = await client
                            .from('users')
                            .select('*')
                            .eq('auth_id', authUser.id)
                            .single();
                        
                        if (!queryError && existingUser) {
                            this.currentUser = existingUser;
                        } else {
                            console.error('重新查询用户数据失败:', queryError);
                            return;
                        }
                    } else {
                        console.error('创建用户记录失败:', createError);
                        return;
                    }
                } else {
                    this.currentUser = createdUser;
                }
            } else {
                // 更新最后登录时间（添加错误处理）
                let updatedUser = null;
                try {
                    const result = await client
                        .from('users')
                        .update({ last_login_at: new Date().toISOString() })
                        .eq('id', userData.id)
                        .select()
                        .single();
                    
                    if (result.error) {
                        console.warn('更新用户登录时间失败:', result.error);
                        // 即使更新失败，也使用原有用户数据
                        updatedUser = userData;
                    } else {
                        updatedUser = result.data;
                    }
                } catch (err) {
                    console.warn('更新用户登录时间异常:', err);
                    // 使用原有用户数据
                    updatedUser = userData;
                }

                this.currentUser = updatedUser;
            }

            console.log('用户登录成功:', this.currentUser);
            
            // 通知认证状态更新
            this.notifyAuthListeners('SIGNED_IN', { user: this.currentUser });
        } catch (error) {
            console.error('处理用户会话失败:', error);
        } finally {
            // 清理处理标记
            if (authUser?.id) {
                this.processingUsers.delete(authUser.id);
            }
        }
    }

    // 处理登出
    handleSignOut() {
        // 防止重复处理登出
        if (!this.currentUser) {
            return;
        }
        
        this.currentUser = null;
        console.log('用户已登出');
        
        // 通知认证状态更新
        this.notifyAuthListeners('SIGNED_OUT', { user: null });
    }

    // 邮箱密码注册
    async signUp(email, password, fullName) {
        try {
            const { data, error } = await window.Auth.signUpWithEmail(email, password, {
                full_name: fullName
            });

            if (error) {
                throw error;
            }

            return {
                success: true,
                data,
                message: '注册成功！请检查您的邮箱以验证账户。'
            };
        } catch (error) {
            console.error('注册失败:', error);
            
            // 使用全局错误处理器处理认证错误
            if (window.ErrorHandler) {
                window.ErrorHandler.handleAuthError(error);
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 邮箱密码登录
    async signIn(email, password) {
        try {
            const { data, error } = await window.Auth.signInWithEmail(email, password);

            if (error) {
                throw error;
            }

            return {
                success: true,
                data,
                message: '登录成功！'
            };
        } catch (error) {
            console.error('登录失败:', error);
            
            // 使用全局错误处理器处理认证错误
            if (window.ErrorHandler) {
                window.ErrorHandler.handleAuthError(error);
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 登出
    async signOut() {
        try {
            const { error } = await window.Auth.signOut();
            if (error) {
                throw error;
            }

            return {
                success: true,
                message: '已成功登出'
            };
        } catch (error) {
            console.error('登出失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 重置密码
    async resetPassword(email) {
        try {
            const { error } = await window.Auth.resetPassword(email);

            if (error) {
                throw error;
            }

            return {
                success: true,
                message: '密码重置邮件已发送，请检查您的邮箱。'
            };
        } catch (error) {
            console.error('重置密码失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 更新用户资料
    async updateProfile(updates) {
        try {
            if (!this.currentUser) {
                throw new Error('用户未登录');
            }
            const client = window.Auth?.getClient?.();
            if (!client) {
                throw new Error('Supabase 客户端未初始化');
            }

            // 更新 Supabase Auth 用户信息
            const authUpdates = {};
            if (updates.email) authUpdates.email = updates.email;
            if (updates.password) authUpdates.password = updates.password;
            if (updates.full_name || updates.avatar_url) {
                authUpdates.data = {
                    full_name: updates.full_name,
                    avatar_url: updates.avatar_url
                };
            }

            if (Object.keys(authUpdates).length > 0) {
                const { error: authError } = await client.auth.updateUser(authUpdates);
                if (authError) {
                    throw authError;
                }
            }

            // 更新我们数据库中的用户信息
            const dbUpdates = {};
            if (updates.full_name) dbUpdates.full_name = updates.full_name;
            if (updates.avatar_url) dbUpdates.avatar_url = updates.avatar_url;

            if (Object.keys(dbUpdates).length > 0) {
                const { data, error } = await client
                    .from('users')
                    .update(dbUpdates)
                    .eq('id', this.currentUser.id)
                    .select()
                    .single();

                if (error) {
                    throw error;
                }

                this.currentUser = data;
            }

            return {
                success: true,
                data: this.currentUser,
                message: '资料更新成功！'
            };
        } catch (error) {
            console.error('更新资料失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 获取当前用户
    getCurrentUser() {
        return this.currentUser;
    }

    // 检查是否已登录
    isAuthenticated() {
        return !!this.currentUser;
    }

    // 检查认证状态（别名方法）
    async checkAuthState() {
        return await this.init();
    }

    // 添加认证状态监听器
    addAuthListener(callback) {
        this.authListeners.push(callback);
    }

    // 移除认证状态监听器
    removeAuthListener(callback) {
        const index = this.authListeners.indexOf(callback);
        if (index > -1) {
            this.authListeners.splice(index, 1);
        }
    }

    // 通知所有认证监听器
    notifyAuthListeners(event, session) {
        console.log('通知认证监听器:', { event, user: this.currentUser, session }); // 调试日志
        
        // 调用内部监听器回调
        this.authListeners.forEach(callback => {
            try {
                callback(event, session, this.currentUser);
            } catch (error) {
                console.error('认证监听器执行失败:', error);
            }
        });

        // 注意：不在这里派发 auth-changed 事件，避免与 supabase.js 的事件形成循环
        // supabase.js 已经负责派发 auth-changed 事件
    }

    // 获取用户统计信息
    async getUserStats() {
        try {
            if (!this.currentUser) {
                throw new Error('用户未登录');
            }
            const client = window.Auth?.getClient?.();
            if (!client) {
                throw new Error('Supabase 客户端未初始化');
            }

            // 获取简历分析统计
            const { data: resumeStats, error: resumeError } = await client
                .from('resume_analyses')
                .select('id, status, overall_score, created_at')
                .eq('user_id', this.currentUser.id);

            if (resumeError) {
                throw resumeError;
            }

            // 获取面试分析统计
            const { data: interviewStats, error: interviewError } = await client
                .from('interview_analyses')
                .select('id, status, overall_score, recommendation, created_at')
                .eq('user_id', this.currentUser.id);

            if (interviewError) {
                throw interviewError;
            }

            return {
                success: true,
                data: {
                    resumeAnalyses: {
                        total: resumeStats.length,
                        completed: resumeStats.filter(r => r.status === 'completed').length,
                        averageScore: resumeStats.length > 0 
                            ? Math.round(resumeStats.reduce((sum, r) => sum + (r.overall_score || 0), 0) / resumeStats.length)
                            : 0
                    },
                    interviewAnalyses: {
                        total: interviewStats.length,
                        completed: interviewStats.filter(i => i.status === 'completed').length,
                        averageScore: interviewStats.length > 0
                            ? Math.round(interviewStats.reduce((sum, i) => sum + (i.overall_score || 0), 0) / interviewStats.length)
                            : 0,
                        recommendations: {
                            hire: interviewStats.filter(i => i.recommendation === 'hire').length,
                            maybe: interviewStats.filter(i => i.recommendation === 'maybe').length,
                            no_hire: interviewStats.filter(i => i.recommendation === 'no_hire').length
                        }
                    }
                }
            };
        } catch (error) {
            console.error('获取用户统计失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// 创建全局实例
const auth = new AuthManager();

// 导出到全局作用域（兼容性）
if (typeof window !== 'undefined') {
    window.auth = auth;
}

// ES6 模块导出
export { auth };