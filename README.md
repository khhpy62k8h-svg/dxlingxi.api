# dxlingxiAPI（dxLingxiAPI）

国内开发者AI模型聚合平台

官网：

https://www.dxlingxiapi.top

---

## 🚀 支持模型

- GPT 系列
- Claude 系列
- DeepSeek 系列

---

## 🖥️ 支持客户端

- Cursor
- Claude Code
- Cherry Studio
- Open WebUI
- NextChat
- ChatBox

---

## 🔑 获取API Key

访问官网：

https://www.dxlingxiapi.top

注册账号后即可创建API Key。

---

## 🐍 Python调用示例

安装SDK：

```bash
pip install openai
```

调用示例：

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-xxxxxxxx",
    base_url="你的BaseURL"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {
            "role": "user",
            "content": "你好"
        }
    ]
)

print(response.choices[0].message.content)
```

---

## ⚙️ Cursor配置教程

1. 打开 Cursor
2. 进入 Settings
3. 进入 Models
4. 选择 OpenAI Compatible
5. 填写 API Key
6. 填写 Base URL
7. 保存配置

---

## 🤖 Claude Code配置教程

支持 OpenAI Compatible 接口接入。

填写：

- API Key
- Base URL

即可开始使用。

---

## 🍒 Cherry Studio配置教程

新增模型供应商：

填写：

- API Key
- Base URL

保存即可。

---

## 🌐 Open WebUI配置教程

新增 OpenAI Endpoint：

填写：

- API Key
- Base URL

保存配置即可。

---

## 📚 常见问题

### 是否兼容OpenAI格式？

支持。

### 是否支持流式输出？

支持。

### 是否支持第三方客户端？

支持。

### 是否支持多模型切换？

支持。

---

## 🔗 官方网站

https://www.dxlingxiapi.top

欢迎开发者接入测试。
