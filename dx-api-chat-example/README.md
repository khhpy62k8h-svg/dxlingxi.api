# DX API 接入示例

用 Node.js 内置 `fetch` 完成一次非流式文本对话，输出回答及服务端返回的 Token 用量，无第三方依赖。

本项目由 DX API 站方准备，包含站方链接与活动说明。代码只经过本地模拟服务测试，未使用真实密钥、未调用或实测 DX API，也不代表 OpenAI 或其他模型提供方的官方项目。

## 适用条件

仅用于你的控制台明确标明兼容 **OpenAI Chat Completions** 的渠道和文本模型。Claude、Gemini、DeepSeek 等原生协议不能仅凭模型名称直接套用此示例。

API Base、密钥、模型 ID 均须从自己的控制台确认。程序不会猜测域名、自动添加 `/v1`、选择福利分组或替换模型。它只在你填写的 API Base 后拼接标准 `/chat/completions` 路径；控制台给出的 Base 若已经带 `/v1`，照原样保留。

## 运行

本机验证版本为 Node.js `v24.19.0`，项目要求 Node.js 24 或以上。无需 `npm install`。

在项目目录将 `.env.example` 复制为 `.env`，填入：

```dotenv
DX_API_BASE_URL=控制台中确认的完整API_Base
DX_API_KEY=你自己的渠道密钥
DX_API_MODEL=控制台确认可用的模型ID
DX_API_TIMEOUT_MS=60000
```

上述三项中文是填写说明，不能原样用于请求。API Base 应指向接口基础路径，不是网页控制台地址，也不包含最终 `/chat/completions`。

在终端运行：

```sh
node --env-file=.env chat.mjs "请用三句话说明什么是 API。"
```

也可通过系统环境变量传入同名配置，再运行：

```sh
node chat.mjs "请用三句话说明什么是 API。"
```

每次运行只发送一个用户消息，设置 `stream: false`。修改 `.env` 中的模型 ID，可以切换控制台允许、且该渠道支持 Chat Completions 的模型。

示例输出格式：

```text
Model: 服务端实际返回的模型名

这里显示模型回答

Input tokens: 7
Output tokens: 5
Total tokens: 12
Usage is reported by the server; billing is determined by the console.
```

以上数字仅为本地模拟输出。服务端未返回某项用量时显示 `not returned`，不根据字符数估算，也不把 Token 数转换为人民币金额。实际扣费、缓存、分组倍率和上下文档位以控制台账单为准。

## 常见错误

| 提示 | 检查项 |
|---|---|
| 缺少 `DX_API_*` | 三项必填配置是否填写，运行目录和 `.env` 路径是否正确 |
| HTTP 401 / 403 | 密钥、分组权限、模型权限 |
| HTTP 404 或非 JSON | API Base 是否误填为网站首页；渠道是否支持 Chat Completions |
| HTTP 400 / 422 | 模型是否支持该请求格式 |
| HTTP 429 | 余额、分组额度、限速；确认后自行决定是否重试 |
| 超时 / 5xx | 网络、服务状态、上游状态；默认超时60秒，可调整到最多600秒 |
| `No text answer` | 是否选择了只返回工具调用等非文本结果的配置 |

程序不自动重试，避免在超时或网络错误后重复触发可能已计费的请求。不会打印密钥或服务端原始错误正文；HTTP 重定向会被阻止。真实请求只允许 HTTPS，本地回环 HTTP 仅用于测试。

## 本地验证

```sh
node --test
```

测试通过 Node.js 内置 HTTP 服务监听 `127.0.0.1` 的随机端口，用明显的虚构密钥验证请求路径、认证头、请求体、回答解析、用量、CLI 错误退出、429、超时、非 JSON、非文本结果和重定向阻止。

测试不读取 `.env`，不请求 DX API，不消耗真实模型额度。通过这些测试只能证明示例在模拟环境中的行为，不能证明某个渠道或模型的实际可用性。

`.env` 已加入 `.gitignore`。发布到 GitHub / Gitee 时只上传源码、`.env.example` 和文档，勿上传真实密钥、账单截图或其他用户数据。

请求结构参考：[OpenAI 官方 Chat Completions 文档](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)。协议兼容范围仍须由你所用渠道确认。

## 站点与活动

站方官网：[DX API](https://api.dxlingxiapi.top)；公开价格页：[模型价格](https://api.dxlingxiapi.top/pricing)。

站方提供的活动信息如下，日期为2026年10月29日；参与前请在站内核对当前有效规则：

1. 充值30元抽盲盒，最高30元兑换卡。
2. “我要创收”，拉新返利最高15%。
3. 指定 GPT 福利分组0.05x起；倍率以本站模型详情显示的基础价格为基准，不代表全部模型或全部上下文档位。
4. 累计充值100元以上，全模型9折，视频模型除外。

盲盒概率、兑换卡期限、返利条件、100元是否包含在门槛内、折扣叠加及权益有效期，应以完整活动规则为准；本项目不补充未确认的活动条件，也不承诺收益、服务稳定性或全部模型兼容。

## 许可

源码采用 MIT 许可，见 `LICENSE`。服务条款、模型使用权限与站内活动另以对应站点规则为准。
