# website

三模型实时仪表盘（英文界面）。展示 CH-3、CH-4、八因子三个 long-short 模型的
模型介绍、关键比率、live 净值、当前持仓、调仓变化和因子信息，外加一个
长多策略（EP Top30 / MultiFactor Top20）附页。

## 查看方式

直接双击打开 `website/index.html` 即可（纯静态、无外部依赖、离线可用），
或起本地服务：

```bash
python3 -m http.server 8787 --directory website
# 浏览器打开 http://localhost:8787
```

## 文件结构

| 文件 | 内容 |
|---|---|
| `index.html` | 单页四分页（CH-3 / CH-4 / Eight-Factor / Long-Only Live），由 `scripts/27_build_website.py` 从 `web_templates/index.html.j2` 渲染。 |
| `assets/chart.umd.js` | 本地化的 Chart.js v4（离线可用）。 |
| `assets/style.css` | 样式，自动跟随系统浅色/深色模式。 |
| `assets/app.js` | 前端渲染逻辑：分页切换、22 张图表、持仓/调仓/因子表格。 |
| `data/trove_web.db` | SQLite 数据库，由 `scripts/26_build_web_database.py` 生成，聚合历史因子收益、回测净值/绩效和 live 输出。 |
| `data/dashboard_data.js` | 前端数据（`window.DASHBOARD_DATA`），由 `scripts/27_build_website.py` 从数据库计算派生序列后生成。用 `<script>` 注入而非 fetch，保证 `file://` 直开可用。 |

## 每日自动更新

macOS launchd 代理 `~/Library/LaunchAgents/com.trove.daily-update.plist`
每天 08:00（美东，A 股收盘后）运行 `scripts/run_daily_update.sh`：

```text
24 财报增量更新（周频，平时自动跳过）
→ 16 live 行情/信号/长多策略
→ 25 三模型 live 因子组合全量重建（幂等）
→ 26 刷新 SQLite
→ 27 重新生成网站（原子替换）
```

- 手动运行：`scripts/run_daily_update.sh`（可加 `--force` 强制财报刷新）。
- 运行日志：`live_tracking/daily_update.log` 和 `live_tracking/launchd.log`。
- 电脑睡眠错过定时会在唤醒后补跑；关机错过则下次任意一次运行自动补齐
  （所有步骤幂等，重复运行不会产生重复数据）。
- 管理定时任务：
  ```bash
  launchctl bootout gui/$(id -u)/com.trove.daily-update      # 停用
  launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.trove.daily-update.plist  # 重新启用
  launchctl kickstart gui/$(id -u)/com.trove.daily-update    # 立即触发一次
  ```

## 三个模型的 live 口径

由 `scripts/25_live_factor_models.py` 构建（without_bottom30 样本，
月末调仓、市值加权 2x3、次日生效、模型净值扣 20bps 单边换手成本）：

| 模型 | 组合 | 对应回测策略 |
|---|---|---|
| `CH3_MODEL` | 等权 SMB + VMG | `Factor_CH3_Equal_SMB_VMG` |
| `CH4_MODEL` | 等权 SMB + VMG + PMO | `Factor_CH4_Equal_SMB_VMG_PMO` |
| `EIGHT_MODEL` | COMPOSITE long-short | `eight_factor_outputs` 的 COMPOSITE |

live 输出保存在 `live_tracking/live_model_*.csv`，每次运行全量重建。
