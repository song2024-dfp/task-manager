/**
 * 智能任务管理系统 - 后端服务
 * Node.js + Express + Supabase (@supabase/supabase-js)
 */
const path = require('path');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// 加载 .env（Node 18+ 用内置能力，无需 dotenv 依赖）
try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(path.join(__dirname, '.env'));
  }
} catch (e) {
  console.warn('[warn] 读取 .env 失败，将使用系统环境变量:', e.message);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const PORT = Number(process.env.PORT || 3000);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[fatal] 缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY，请检查 .env 文件');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PRIORITIES = ['高', '中', '低'];
const TABLE = 'tasks';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/** 统一错误响应 */
function fail(res, status, message, detail) {
  return res.status(status).json({ ok: false, error: message, detail: detail || null });
}

// ---------- 1. 查询任务列表（支持优先级筛选，按创建时间倒序） ----------
app.get('/api/tasks', async (req, res) => {
  const priority = (req.query.priority || 'all').toString();

  let query = supabase
    .from(TABLE)
    .select('id, title, priority, completed, created_at')
    .order('created_at', { ascending: false });

  if (PRIORITIES.includes(priority)) {
    query = query.eq('priority', priority);
  } else if (priority !== 'all') {
    return fail(res, 400, '无效的优先级筛选参数，只能是 all / 高 / 中 / 低');
  }

  const { data, error } = await query;
  if (error) return fail(res, 502, '查询任务失败', error.message);
  return res.json({ ok: true, data: data || [] });
});

// ---------- 2. 新增任务 ----------
app.post('/api/tasks', async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const priority = (req.body?.priority || '中').toString();

  if (!title) return fail(res, 400, '任务标题不能为空');
  if (title.length > 200) return fail(res, 400, '任务标题不能超过 200 个字符');
  if (!PRIORITIES.includes(priority)) {
    return fail(res, 400, '优先级必须是 高 / 中 / 低');
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ title, priority, completed: false })
    .select('id, title, priority, completed, created_at')
    .single();

  if (error) return fail(res, 502, '新增任务失败', error.message);
  return res.status(201).json({ ok: true, data });
});

// ---------- 3. 切换完成状态 ----------
app.patch('/api/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return fail(res, 400, '任务 ID 不合法');

  if (typeof req.body?.completed !== 'boolean') {
    return fail(res, 400, 'completed 必须是布尔值');
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update({ completed: req.body.completed })
    .eq('id', id)
    .select('id, title, priority, completed, created_at')
    .maybeSingle();

  if (error) return fail(res, 502, '更新任务状态失败', error.message);
  if (!data) return fail(res, 404, '任务不存在');
  return res.json({ ok: true, data });
});

// ---------- 4. 删除任务 ----------
app.delete('/api/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return fail(res, 400, '任务 ID 不合法');

  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)
    .select('id');

  if (error) return fail(res, 502, '删除任务失败', error.message);
  if (!data || data.length === 0) return fail(res, 404, '任务不存在或已被删除');
  return res.json({ ok: true, data: { id } });
});

// 健康检查：确认 Supabase 连通与表结构可用
app.get('/api/health', async (_req, res) => {
  const { error } = await supabase.from(TABLE).select('id', { count: 'exact', head: true });
  if (error) return fail(res, 502, 'Supabase 连接失败', error.message);
  return res.json({ ok: true, data: { supabase: 'connected', table: TABLE } });
});

app.listen(PORT, () => {
  console.log(`任务管理系统已启动: http://localhost:${PORT}`);
  console.log(`Supabase: ${SUPABASE_URL}`);
});
