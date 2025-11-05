// 删除报告 API 端点
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // 只允许 DELETE 方法
    if (req.method !== 'DELETE') {
        res.setHeader('Allow', ['DELETE']);
        return res.status(405).json({ 
            error: 'Method not allowed',
            message: '只支持 DELETE 请求' 
        });
    }

    try {
        // 获取环境变量
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'Supabase 配置缺失'
            });
        }

        // 创建 Supabase 客户端（使用服务角色密钥以绕过 RLS）
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 从请求体获取报告ID和用户ID
        const { reportId, userId } = req.body;

        if (!reportId) {
            return res.status(400).json({
                error: 'Bad request',
                message: '缺少报告ID'
            });
        }

        if (!userId) {
            return res.status(400).json({
                error: 'Bad request', 
                message: '缺少用户ID'
            });
        }

        // 首先验证报告是否存在且属于该用户
        const { data: existingReport, error: fetchError } = await supabase
            .from('reports')
            .select('id, user_id, report_type')
            .eq('id', reportId)
            .eq('user_id', userId)
            .single();

        if (fetchError) {
            console.error('查询报告失败:', fetchError);
            return res.status(500).json({
                error: 'Database error',
                message: '查询报告失败'
            });
        }

        if (!existingReport) {
            return res.status(404).json({
                error: 'Not found',
                message: '报告不存在或无权限删除'
            });
        }

        // 执行删除操作
        const { error: deleteError } = await supabase
            .from('reports')
            .delete()
            .eq('id', reportId)
            .eq('user_id', userId);

        if (deleteError) {
            console.error('删除报告失败:', deleteError);
            return res.status(500).json({
                error: 'Database error',
                message: '删除报告失败'
            });
        }

        // 返回成功响应
        res.status(200).json({
            success: true,
            message: '报告删除成功',
            deletedReport: {
                id: existingReport.id,
                type: existingReport.report_type
            }
        });

    } catch (error) {
        console.error('删除报告API错误:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: '服务器内部错误'
        });
    }
}