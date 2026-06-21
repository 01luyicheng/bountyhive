# BountyHive 文档索引

> **点题**：一只 Agent 踩过的坑，整个蜂群再也不必踩第二次。

本目录整合 BountyHive 项目的所有文档入口。

---

## 项目文档

- [项目 README](../README.md) - 项目说明 + 启动步骤 + HTTP API 合约
- [架构文档](architecture.md) - 技术栈 + 目录结构 + 数据流 + 核心模块 + bounty 时序图

## Demo 文档

- [Demo 脚本](demo-script.md) - 3 分钟逐秒脚本（开场 20s + 冲突 40s + 进化 55s + 高潮 40s + 收尾 25s）
- [Fallback 预案](demo-fallback.md) - 现场应急手册（风险场景 + 决策树 + 诚实告知红线）
- [现场 checklist](demo-checklist.md) - 按时间顺序的执行清单（Demo 前 1h / 5min / Demo 中 / Q&A）
- [Q&A 预案](qa-playbook.md) - 评委问答速查卡（Q1-Q15 + 红线 + 速查索引）

## 方案文档

- [方案 E v5](../方案E-BountyHive-修正版.md) - 完整方案设计（核心机制 + Demo 脚本 + 商业模式 + 获奖概率）

## 官方文档

- [EvoMap skill 文档](../evomap-skill-docs/) - 协议参考（skill-tasks / skill-protocol / skill-advanced / skill-structures）

---

## 快速导航

### 首次上手

1. 阅读 [项目 README](../README.md) 了解项目概况
2. 阅读 [架构文档](architecture.md) 理解技术栈和数据流
3. 运行 `npm run setup` 一键配置开发环境
4. 运行 `npm run dev:mock` 启动 Mock 模式体验

### Demo 准备

1. 阅读 [Demo 脚本](demo-script.md) 熟悉 3 分钟流程
2. 对照 [现场 checklist](demo-checklist.md) 逐项确认
3. 熟读 [Fallback 预案](demo-fallback.md) 应对现场异常
4. 打印 [Q&A 预案](qa-playbook.md) 速查卡备用

### 开发调试

1. 运行 `npm run dev:mock` 启动 Mock 模式（不依赖真实账号）
2. 前端访问 `http://localhost:5173`
3. 后端 API `http://localhost:3001/api/health`
4. 运行 `npm test` 验证端点契约

### 现场演示

1. 按 [现场 checklist](demo-checklist.md) 第一节完成启动
2. 按 [Demo 脚本](demo-script.md) 第五节控制口播节奏
3. 异常时按 [Fallback 预案](demo-fallback.md) 第四节决策树处理
4. Q&A 阶段用 [Q&A 预案](qa-playbook.md) 速查索引定位回答

---

## 文档版本

所有文档均为 **v5 准确版对齐**，生成时间 2026-06-21，依据方案 E v5 + evomap-skill-docs。
