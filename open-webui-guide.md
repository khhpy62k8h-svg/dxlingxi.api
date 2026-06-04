# Open WebUI接入dxlingxiAPI教程（2026最新版）

## 一、注册dxlingxiAPI

官网：

https://www.dxlingxiapi.top

注册账号并登录后台。

---

## 二、创建API Key

进入：

令牌管理 → 创建令牌

复制生成的API Key。

---

## 三、打开Open WebUI

登录Open WebUI后台。

进入：

设置 → Connections

或

设置 → OpenAI API

（不同版本名称略有区别）

---

## 四、添加OpenAI兼容接口

新增接口配置：

### API Key

填写灵犀API后台生成的API Key

### API Endpoint

填写：

https://www.dxlingxiapi.top/v1

---

## 五、保存配置

点击保存。

然后刷新模型列表。

---

## 六、选择模型

推荐模型：

* gpt-5.5
* deepseek-v4-pro
* deepseek-v4-flash
* claude-opus-4-8

---

## 七、测试连接

输入：

你好，请介绍一下你自己

正常返回内容即表示配置成功。

---

## 常见问题

### 提示401错误

请检查：

* API Key是否正确
* API Key是否失效

### 提示连接失败

请检查：

* API Endpoint是否填写正确
* 网络连接是否正常

### 模型列表为空

请检查：

* API账户余额
* 模型权限
* Open WebUI版本

---

## 官方网站

https://www.dxlingxiapi.top

## 接口地址

https://www.dxlingxiapi.top/v1
