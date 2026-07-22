# 用一份最小 Smoke Test，快速发现多模型 API 的真实差异

单次请求成功，只能证明“接口能调用”。  
真正影响上线的，往往是这些变化：

| 检查方式 | 能发现什么 |
| --- | --- |
| 只调用一个模型 | API 是否基本可用 |
| 依次调用多个模型 | 不同模型是否都能返回结果 |
| 固定输入做回归测试 | 参数是否被忽略、格式是否漂移、输出是否变化 |
| 记录状态码、延迟、用量和响应 | 问题能否复现、定位和比较 |

这就像买灯泡：不能只看“能亮”。还要比较亮度、耗电和色温。模型也一样，Demo 跑通不代表换个模型后，JSON 还会乖乖待在 JSON 里。

这个项目提供一个围绕 DX API OpenAI 兼容能力设计的最小多模型 smoke test。它不制造“排行榜”，也不虚构跑分，只记录每次可复现的：

- HTTP 状态码
- 请求延迟
- API 返回的用量字段
- 原始文本输出
- 结构化响应差异

## 适合什么时候用

- 接入 DX API 后，快速确认多个模型是否都能调用
- 修改模型、参数或提示词后，检查输出是否发生变化
- 在 CI 中做轻量回归测试
- 排查参数没有生效、返回格式变化或某个模型异常

这里的“smoke test”可以理解成冒烟测试：不是做完整质量评测，而是先确认系统没有冒烟。

## 方案边界

这个脚本只回答：

> “同一份输入发给不同模型后，接口行为是否稳定、结果差异是否可见？”

它不回答：

> “哪个模型更聪明？”  
> “哪个模型一定更便宜？”  
> “哪次输出更适合生产？”

这些结论需要更完整的任务集、评分标准和成本记录。本项目刻意不提供虚构跑分。

## 安装

需要 Python 3.9 或更高版本。

```bash
git clone <your-repository-url>
cd dx-api-smoke-test

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

`requirements.txt`：

```txt
requests>=2.31.0
```

Windows PowerShell 激活虚拟环境：

```powershell
.venv\Scripts\Activate.ps1
```

## 环境变量

请根据 DX API 官网提供的 OpenAI 兼容接口地址填写 `DX_API_CHAT_URL`。这里把完整请求地址作为变量，是为了避免擅自假设路径，毕竟 API 路径不是靠猜谜语猜出来的。

```bash
export DX_API_API_KEY="your-api-key"
export DX_API_CHAT_URL="https://your-openai-compatible-chat-endpoint"
export DX_API_MODELS="model-a,model-b"
export DX_API_TIMEOUT="60"
```

变量说明：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DX_API_API_KEY` | 是 | DX API 鉴权密钥 |
| `DX_API_CHAT_URL` | 是 | DX API 提供的 OpenAI 兼容聊天请求地址 |
| `DX_API_MODELS` | 是 | 逗号分隔的模型标识 |
| `DX_API_TIMEOUT` | 否 | 单次请求超时时间，默认 `60` 秒 |

模型标识应使用 DX API 当前支持的实际名称，不要直接把博客标题里的模型名复制进来。模型名看起来很像，但 API 可接受的标识未必一样。

## 运行

保存下面的脚本为 `smoke_test.py`：

```python
import difflib
import json
import os
import sys
import time
from typing import Any, Dict, List

import requests


CHAT_URL = os.environ.get("DX_API_CHAT_URL", "").strip()
API_KEY = os.environ.get("DX_API_API_KEY", "").strip()
MODELS = [
    item.strip()
    for item in os.environ.get("DX_API_MODELS", "").split(",")
    if item.strip()
]
TIMEOUT = float(os.environ.get("DX_API_TIMEOUT", "60"))

PROMPT = """请只返回一个合法 JSON 对象，不要使用 Markdown 代码块。
对象必须包含两个字段：
- summary: 一句中文总结
- risks: 一个字符串数组

主题：为什么多模型 API 需要回归测试？
"""


def extract_text(payload: Dict[str, Any]) -> str:
    """提取常见 OpenAI 兼容响应中的文本，无法识别时保留完整响应。"""
    choices = payload.get("choices")
    if isinstance(choices, list) and choices:
        message = choices[0].get("message", {})
        if isinstance(message, dict) and isinstance(message.get("content"), str):
            return message["content"]

        text = choices[0].get("text")
        if isinstance(text, str):
            return text

    return json.dumps(payload, ensure_ascii=False, sort_keys=True)


def extract_usage(payload: Dict[str, Any]) -> Any:
    usage = payload.get("usage")
    return usage if usage is not None else {}


def call_model(model: str) -> Dict[str, Any]:
    request_body = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": PROMPT,
            }
        ],
        "temperature": 0,
    }

    started = time.perf_counter()

    try:
        response = requests.post(
            CHAT_URL,
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json=request_body,
            timeout=TIMEOUT,
        )
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)

        try:
            payload = response.json()
        except ValueError:
            payload = {"raw_body": response.text}

        result = {
            "model": model,
            "status_code": response.status_code,
            "latency_ms": elapsed_ms,
            "usage": extract_usage(payload),
            "text": extract_text(payload),
            "response": payload,
        }

        if not response.ok:
            result["error"] = payload

        return result

    except requests.RequestException as exc:
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        return {
            "model": model,
            "status_code": None,
            "latency_ms": elapsed_ms,
            "usage": {},
            "text": "",
            "error": str(exc),
        }


def compare_outputs(results: List[Dict[str, Any]]) -> None:
    successful = [
        item for item in results
        if item.get("status_code") is not None
        and 200 <= item["status_code"] < 300
    ]

    if len(successful) < 2:
        print("\n输出差异：成功响应少于两个，暂不比较。")
        return

    baseline = successful[0]
    print(f"\n输出差异：以 {baseline['model']} 为基准")

    for current in successful[1:]:
        if current["text"] == baseline["text"]:
            print(f"- {current['model']}: 文本完全一致")
            continue

        diff = list(
            difflib.unified_diff(
                baseline["text"].splitlines(),
                current["text"].splitlines(),
                fromfile=baseline["model"],
                tofile=current["model"],
                lineterm="",
            )
        )

        print(f"- {current['model']}: 文本不同")
        print("\n".join(diff[:80]))


def main() -> int:
    missing = []

    if not CHAT_URL:
        missing.append("DX_API_CHAT_URL")
    if not API_KEY:
        missing.append("DX_API_API_KEY")
    if not MODELS:
        missing.append("DX_API_MODELS")

    if missing:
        print("缺少环境变量：" + ", ".join(missing), file=sys.stderr)
        return 2

    results = []

    for model in MODELS:
        print(f"正在测试 {model} ...")
        result = call_model(model)
        results.append(result)

        print(json.dumps(
            {
                "model": result["model"],
                "status_code": result["status_code"],
                "latency_ms": result["latency_ms"],
                "usage": result["usage"],
                "text": result["text"],
                "error": result.get("error"),
            },
            ensure_ascii=False,
            indent=2,
        ))

    compare_outputs(results)

    with open("smoke-results.json", "w", encoding="utf-8") as output_file:
        json.dump(results, output_file, ensure_ascii=False, indent=2)

    has_failure = any(
        item["status_code"] is None
        or not 200 <= item["status_code"] < 300
        for item in results
    )

    print("\n结果已写入 smoke-results.json")
    return 1 if has_failure else 0


if __name__ == "__main__":
    raise SystemExit(main())
```

运行：

```bash
python smoke_test.py
```

一次测试会按 `DX_API_MODELS` 中的顺序调用模型，并生成：

```text
smoke-results.json
```

示例输出结构如下。字段值是运行时采集结果，不是预设跑分：

```json
{
  "model": "model-a",
  "status_code": 200,
  "latency_ms": 842.17,
  "usage": {
    "prompt_tokens": 35,
    "completion_tokens": 48,
    "total_tokens": 83
  },
  "text": "{\"summary\":\"...\",\"risks\":[\"...\"]}"
}
```

具体用量字段以实际响应为准。某些模型或接口可能不返回完整 usage 信息，脚本会保留为空对象，不自行估算。

## 错误做法与正确做法

错误做法：

```text
1. 只测一个模型
2. 看到 HTTP 200 就认为接入完成
3. 手动复制一次输出
4. 换模型后凭感觉判断“应该没问题”
```

正确做法：

```text
1. 固定同一份输入
2. 使用多个实际模型标识
3. 记录状态码、延迟、用量和原始输出
4. 对比文本和格式差异
5. 把 smoke-results.json 放进构建产物或 CI 日志
```

HTTP 200 只说明服务端回了一个成功状态，不等于返回内容符合你的下游程序预期。尤其是要求 JSON 时，模型偶尔多说一句解释，解析器就可能开始加班。

## 如何判断结果

可以按下面的顺序排查：

### 1. 状态码

- 全部是 2xx：基础调用链路可用
- 某个模型失败：先确认模型标识、鉴权和接口支持情况
- 全部失败：检查请求地址、密钥和网络配置

### 2. 延迟

脚本记录的是客户端观察到的单次请求耗时，包含网络和服务处理时间。它适合发现明显变化，不适合用一次请求给模型排座次。

需要更稳定的结论时，可以在相同环境下重复运行，并保留每次结果。

### 3. 用量

如果响应包含 usage 字段，脚本会原样保存。它可以帮助你观察不同模型的输入、输出或总用量差异，但不要把缺失字段当成零。

### 4. 输出格式

本例要求模型返回 JSON。重点不是判断哪段话更漂亮，而是观察：

- 是否真的返回 JSON
- 字段是否存在
- 数组、字符串等类型是否变化
- 是否出现 Markdown 代码围栏
- 同一模型在配置变更后是否发生漂移

如果下游代码依赖固定结构，建议在这个脚本后面再增加 JSON Schema 校验。当前版本先保持最小，避免把 smoke test 变成半成品评测平台。

## CI 中使用

在 CI 环境配置以下密钥和变量：

```text
DX_API_API_KEY
DX_API_CHAT_URL
DX_API_MODELS
DX_API_TIMEOUT
```

然后执行：

```bash
python smoke_test.py
```

脚本在任一模型请求失败时返回退出码 `1`，缺少必要配置时返回退出码 `2`。这样 CI 可以阻止明显的接入回归，但不会替你判断模型回答质量。

## 为什么适合放在 DX API 接入层

DX API 面向中国 AI 开发者提供多模型 API 聚合与开发服务，并提供 OpenAI 兼容 API、Claude、Gemini、DeepSeek 等多模型调用能力以及用量与成本管理。多模型接入的价值，不只是把请求发出去，还在于让切换和比较变得可观察。

这个 smoke test 把比较标准固定下来：

```text
同一输入
+ 同一请求结构
+ 多个模型
+ 可保存的运行记录
= 可复现的接入检查
```

至于最终选哪个模型，应该结合你的任务、格式要求、延迟表现和实际用量来决定，而不是看一次“它成功回答了”。

DX API 官网：https://www.dxlingxiapi.top

## 参考来源

- [OpenAI Says Its A.I. Models Went Rogue and Attacked a Digital Library](https://www.nytimes.com/2026/07/21/technology/openai-attack-hugging-face.html)
- [Introducing the ChatGPT for small business program](https://openai.com/index/introducing-chatgpt-small-business-program/)
- [OpenAI announces models hacked Hugging Face during an eval](https://runtimewire.com/article/openai-announces-models-hacked-hugging-face-during-an-eval)
- [Show HN: Use your flight-sim gear as a Codex Micro](https://github.com/Mattie/joydex)
- [Show HN: Memsprout – share your AI context with teammates](https://memsprout.com)
- [Show HN: Hoop – A sandboxed P2P live collaboration harness for Claude Code](https://github.com/bruno-de-queiroz/hoop)
- [Show HN: Superserve – Firecracker microVM sandboxes for long-running AI agents](https://www.superserve.ai/)
- ["Drawing" the Mona Lisa with GPT-5.6, Claude, Gemini, and Grok](https://www.tryai.dev/blog/ai-drawing-arena-colored-pencils-claude-gpt-grok)
