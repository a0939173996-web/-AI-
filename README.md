# SafeGlow AI

Local-First 嬰兒房夜燈／微動感知實驗：**區網直連**，不連外網雲端。

## 內容

| 路徑 | 說明 |
| --- | --- |
| [`SafeGlow_MR60BHA2_NightLight/`](SafeGlow_MR60BHA2_NightLight/) | MR60BHA2（XIAO ESP32C6）板載 WS2812 韌體：雷達聯動 + TCP/UDP JSON |
| [`SafeGlow_App/`](SafeGlow_App/) | Expo App：接收實機 JSON，夜燈亮度／顏色指令回傳開發板 |

## 快速對接

1. 燒錄韌體，開發板連上手機熱點，記下 IP（例如 `192.168.43.xx`）
2. 開啟 `SafeGlow_App`，在連線面板填入該 IP、TCP `4211`
3. Dashboard 顯示實機串流；Nightlight 頁滑桿／色票會下發至板子
