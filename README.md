# 智能任务管理系统（Node.js + Supabase）

一个中文界面的任务管理应用，数据托管在你自己的 Supabase 项目。

## 功能

- 输入框 + 优先级下拉（高 / 中 / 低）添加任务
- 任务列表显示标题、优先级徽章、完成状态、创建时间
- 每条任务支持「标为完成 / 标为未完成」切换和「删除」
- 按优先级筛选：全部 / 高 / 中 / 低
- 任务按创建时间倒序显示，已完成任务标题加删除线并置灰

## 目录结构

```
task-manager-supabase/
├── server.js              # Express 服务 + Supabase 数据访问
├── public/index.html      # 前端页面（中文界面）
├── .env                   # Supabase URL 与 anon key
├── package.json
├── preview.png            # 界面预览截图
└── README.md
```

## 启动

```bash
cd task-manager-supabase
npm install      # 已安装可跳过
npm start
```

浏览器打开 <http://localhost:3000>。改端口在 `.env` 里改 `PORT`。

## Supabase 表结构

表名 `tasks`：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | 自增主键 |
| title | text | 任务标题 |
| priority | text | `高` / `中` / `低` |
| completed | boolean | 默认 false |
| created_at | timestamptz | 默认当前时间 |

建表 SQL（如换新项目可执行）：

```sql
create table if not exists tasks (
  id bigserial primary key,
  title text not null,
  priority text not null check (priority in ('高','中','低')),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists tasks_created_at_idx on tasks (created_at desc);

-- 当前配置使用 anon/publishable key，需允许匿名读写
alter table tasks enable row level security;
create policy "anon read"   on tasks for select using (true);
create policy "anon insert" on tasks for insert with check (true);
create policy "anon update" on tasks for update using (true) with check (true);
create policy "anon delete" on tasks for delete using (true);
```

## 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tasks?priority=all\|高\|中\|低` | 查询列表，按创建时间倒序 |
| POST | `/api/tasks` | 新增，body：`{ title, priority }` |
| PATCH | `/api/tasks/:id` | 切换完成状态，body：`{ completed }` |
| DELETE | `/api/tasks/:id` | 删除任务 |
| GET | `/api/health` | 检查 Supabase 连接与表可用性 |

## 注意

当前 `.env` 用的是 anon（publishable）key，表上已开放匿名读写策略，适合个人自用。
若要对外发布，建议改用 Supabase Auth 登录 + 按用户隔离的 RLS 策略，并只在前端持有 anon key（service_role key 绝不能出现在前端或公开代码里）。
