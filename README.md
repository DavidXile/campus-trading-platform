# 🏫 校园二手交易平台

<div align="center">

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-18.2.0-blue.svg)
![MySQL](https://img.shields.io/badge/mysql-5.7%2B-orange.svg)

一个功能完整的校园二手交易平台，采用前后端分离架构，支持商品交易、跑腿任务、实时聊天、纠纷处理等核心功能。

[功能特性](#-功能特性) • [技术栈](#-技术栈) • [快速开始](#-快速开始) • [项目结构](#-项目结构)

</div>

---

## 📖 项目简介

校园二手交易平台是一个专为校园环境设计的全栈Web应用，旨在为学生提供便捷的二手物品交易和跑腿服务。项目采用现代化的技术栈，实现了完整的交易流程、实时通信、支付系统、信用体系等功能模块。

### 核心亮点

- 🛒 **完整的交易流程** - 从商品发布到购买完成的完整闭环
- 🏃 **跑腿任务系统** - 支持任务发布、接单、双方确认完成
- 💬 **实时聊天系统** - 基于WebSocket的即时消息推送
- ⚖️ **纠纷处理机制** - 完善的纠纷发起、审核、申诉流程
- 💰 **支付与信用系统** - 钱包余额管理、交易记录、信用评分
- 👨‍💼 **管理后台** - 数据统计、用户管理、内容审核
- 🌐 **国际化支持** - 中英文切换

---

## ✨ 功能特性

### 用户功能

- ✅ **用户认证系统**
  - 用户注册/登录（JWT认证）
  - 密码找回功能
  - 用户资料管理（头像、联系方式、学院信息）
  - 密码修改

- ✅ **商品交易**
  - 商品发布、编辑、删除
  - 商品浏览、搜索、分类筛选
  - 商品详情展示（图片、描述、价格）
  - 购买流程（余额检查、支付处理）
  - 购买记录管理

- ✅ **跑腿任务**
  - 任务发布（地点、目的地、报酬、截止时间）
  - 任务浏览与接单
  - 双方确认完成机制
  - 任务状态管理（待接单/已接单/已完成/已取消）
  - 我的任务管理

- ✅ **实时聊天**
  - 基于WebSocket的实时消息推送
  - 会话管理（按商品/任务维度）
  - 消息已读/未读状态
  - 会话删除（暂时删除/永久删除）
  - 图片和附件发送

- ✅ **纠纷处理**
  - 纠纷发起（支持多种纠纷类型）
  - 证据上传（图片）
  - 纠纷响应机制
  - 申诉功能（支持改判）

- ✅ **钱包与信用**
  - 钱包余额管理
  - 交易记录查询
  - 退款处理（全额/部分退款）
  - 用户信用评分机制

### 管理功能

- ✅ **数据统计**
  - 用户统计（总数、新增用户）
  - 商品统计（总数、在售/已售）
  - 纠纷统计（待处理纠纷）
  - 数据可视化展示

- ✅ **用户管理**
  - 用户列表查看
  - 用户封禁（临时/永久）
  - 角色管理（普通用户/管理员）
  - 用户搜索与筛选

- ✅ **内容管理**
  - 商品管理（查看、删除）
  - 纠纷审核与处理
  - 申诉审核

---

## 🛠️ 技术栈

### 前端

- **框架**: React 18.2.0
- **构建工具**: Vite 4.5.0
- **UI组件库**: Ant Design Mobile 5.33.1
- **状态管理**: Zustand 4.4.7
- **路由**: React Router 6.20.1
- **HTTP客户端**: Axios 1.6.2
- **实时通信**: Socket.IO Client 4.8.1
- **国际化**: i18next 25.7.1 + react-i18next 16.4.0
- **代码规范**: ESLint

### 后端

- **运行时**: Node.js 16+
- **框架**: Express 4.18.2
- **数据库**: MySQL 5.7+
- **ORM**: mysql2 3.6.5
- **认证**: JWT (jsonwebtoken 9.0.2)
- **密码加密**: bcryptjs 2.4.3
- **实时通信**: Socket.IO 4.5.4
- **环境变量**: dotenv 16.3.1
- **跨域**: cors 2.8.5

### 开发工具

- **测试框架**: Jest 29.7.0 + Supertest 6.3.3
- **开发服务器**: Nodemon 3.0.2
- **环境变量**: cross-env 7.0.3

---

## 📁 项目结构

```
campus-trading-platform/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── config/         # 配置文件（数据库连接等）
│   │   ├── controllers/    # 控制器（业务逻辑）
│   │   ├── middlewares/   # 中间件（认证、权限等）
│   │   ├── routes/         # 路由定义
│   │   ├── services/       # 服务层（支付、信用等）
│   │   ├── utils/          # 工具函数
│   │   └── index.js        # 入口文件
│   ├── scripts/            # 数据库迁移脚本
│   ├── __tests__/         # 测试文件
│   ├── database/          # 数据库脚本
│   ├── package.json
│   └── .env               # 环境变量（需自行创建）
│
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── components/    # 公共组件
│   │   ├── pages/         # 页面组件
│   │   │   ├── admin/     # 管理后台页面
│   │   │   └── ...        # 其他页面
│   │   ├── services/      # API服务
│   │   ├── store/         # 状态管理
│   │   ├── i18n/          # 国际化配置
│   │   └── main.jsx       # 入口文件
│   ├── package.json
│   └── vite.config.js
│
├── README.md              # 项目说明文档
└── .gitignore            # Git忽略文件
```

---

## 🚀 快速开始

### 环境要求

- **Node.js**: 16+ (推荐 18+)
- **MySQL**: 5.7+
- **npm**: 或 yarn

### 安装步骤

#### 1. 克隆项目

```bash
git clone https://github.com/DavidXile/campus-trading-platform.git
cd campus-trading-platform
```

#### 2. 后端配置

```bash
# 进入后端目录
cd backend

# 安装依赖
npm install

# 复制环境变量模板
# Windows
copy env-example.txt .env
# Linux/Mac
cp env-example.txt .env

# 编辑 .env 文件，配置数据库信息
# DB_HOST=localhost
# DB_USER=root
# DB_PASSWORD=your_password
# DB_NAME=campus_trading
# DB_PORT=3306
# JWT_SECRET=your_jwt_secret
# PORT=5000
# NODE_ENV=development

# 初始化数据库（完整初始化，推荐首次使用）
npm run init-db-complete

# 创建默认管理员账户
npm run create-admin
# 默认管理员: admin@campus.trading / admin123456

# 启动后端服务
npm run dev
```

后端服务将在 `http://localhost:5000` 启动

#### 3. 前端配置

```bash
# 打开新终端，进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev -- --host --port 5173
```

前端应用将在 `http://localhost:5173` 启动

#### 4. 访问应用

- 前端界面: http://localhost:5173
- 后端API: http://localhost:5000
- 健康检查: http://localhost:5000/

---

## 🧪 测试

### 后端测试

```bash
cd backend
npm test
```

测试覆盖：
- 健康检查接口
- 商品创建/更新验证
- 购买流程（余额检查、支付处理）
- 纠纷创建参数验证
- 跑腿任务创建和分页参数
- 商品列表分页和搜索

### 手动测试建议

1. 注册两个账户（买家/卖家），在前端发布商品
2. 买家购买：余额充足成功；余额不足被阻止并提示
3. 创建纠纷 → 管理员审核 → 申诉，验证状态/金额/信用分变化
4. 切换中英文：管理后台和前端列表/详情页无语言错误

---

## 📸 功能截图

> 提示：您可以在此处添加项目截图，展示主要功能界面

- 商品列表页面
- 商品详情页面
- 聊天界面
- 管理后台
- 跑腿任务页面

---

## 🔧 数据库迁移

如果使用基础初始化，可能需要运行以下迁移脚本：

```bash
cd backend

# 添加用户角色字段
npm run migrate

# 创建跑腿任务表
npm run migrate-errands

# 创建会话功能表
npm run migrate-conversations

# 创建支付和信用相关表
npm run create-payment-credit-tables

# 创建纠纷表
npm run create-disputes-table
```

---

## 📝 API文档

### 主要接口

- **用户相关**: `/api/users/*` - 注册、登录、用户信息
- **商品相关**: `/api/items/*` - 商品CRUD、购买
- **跑腿任务**: `/api/errands/*` - 任务发布、接单、确认
- **聊天相关**: `/api/chat/*` - 会话、消息
- **纠纷相关**: `/api/disputes/*` - 纠纷创建、审核
- **管理后台**: `/api/admin/*` - 统计数据、用户管理
- **钱包相关**: `/api/wallet/*` - 余额查询、交易记录

### WebSocket事件

- `send_message` - 发送消息
- `new_message` - 接收新消息
- `new_message_notification` - 新消息通知

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## ⚠️ 常见问题

### 数据库连接失败

- 检查MySQL服务是否启动
- 验证 `.env` 文件中的 `DB_PASSWORD` 是否正确
- 确认MySQL用户有创建数据库的权限

### 端口被占用

- 修改 `backend/.env` 中的 `PORT` 配置
- 或修改前端启动命令中的端口号

### 前端无法连接后端

- 检查 `frontend/src/services/api.js` 中的API地址是否匹配后端端口
- 确认后端服务已启动

### 依赖安装失败

```bash
npm cache clean --force
npm install
```

---

## 📄 许可证

本项目采用 ISC 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

---

## 👤 作者

本项目由 **Wang Zhaohan** 和 **LuQi** 共同开发完成。

**Wang Zhaohan** (主要开发者)

- GitHub: [@DavidXile](https://github.com/DavidXile)
- Email: xile5201314@gmail.com
- 项目地址: [campus-trading-platform](https://github.com/DavidXile/campus-trading-platform)
- 主要贡献：后端架构设计、API开发、数据库设计、实时通信系统、支付系统、管理后台、项目部署与维护

**LuQi** (项目贡献者)

- GitHub: [@ErenJeagerrr](https://github.com/ErenJeagerrr)
- Email: lu1029072390@163.com
- 主要贡献：运用 React 生态与前端工具参与移动端界面与实时聊天开发；负责全链路功能测试与质量保障，参与需求分析与文档维护。

---

## 🙏 致谢

- [React](https://reactjs.org/)
- [Express](https://expressjs.com/)
- [Ant Design Mobile](https://mobile.ant.design/)
- [Socket.IO](https://socket.io/)

---

<div align="center">

如果这个项目对您有帮助，请给个 ⭐ Star！

Made with ❤️ by [Wang Zhaohan](https://github.com/DavidXile) & [LuQi](https://github.com/ErenJeagerrr)

*This project is a collaborative effort, with Wang Zhaohan as the primary developer and LuQi as a key contributor.*

</div>

