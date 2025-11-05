# API 文档 - AI智能招聘分析系统

## 概述

本文档描述了AI智能招聘分析系统的API接口，包括简历分析和面试分析功能。

### 基本信息
- **API版本**: v1.0
- **基础URL**: `https://your-domain.vercel.app/api`
- **认证方式**: 基于Token的认证
- **数据格式**: JSON
- **字符编码**: UTF-8

### 通用响应格式

#### 成功响应
```json
{
  "success": true,
  "data": {
    // 具体数据内容
  },
  "message": "操作成功",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### 错误响应
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": "详细错误信息"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 状态码说明
- `200` - 请求成功
- `400` - 请求参数错误
- `401` - 未授权访问
- `403` - 禁止访问
- `404` - 资源不存在
- `413` - 文件过大
- `429` - 请求频率过高
- `500` - 服务器内部错误

## 简历分析 API

### 1. 简历分析接口

#### 接口信息
- **URL**: `/resume-analyze`
- **方法**: `POST`
- **内容类型**: `multipart/form-data`
- **描述**: 上传简历文件进行AI分析

#### 请求参数

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| file | File | 是 | 简历文件（PDF/DOC/DOCX/TXT） |
| position | String | 否 | 目标岗位 |
| requirements | String | 否 | 特殊要求 |
| language | String | 否 | 分析语言（zh/en），默认zh |

#### 文件限制
- **支持格式**: PDF, DOC, DOCX, TXT
- **文件大小**: 最大 10MB
- **文件名**: 支持中英文，不超过100字符

#### 请求示例

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('position', '前端开发工程师');
formData.append('requirements', '熟悉React框架');
formData.append('language', 'zh');

fetch('/api/resume-analyze', {
  method: 'POST',
  body: formData,
  headers: {
    'Authorization': 'Bearer your-token'
  }
})
.then(response => response.json())
.then(data => console.log(data));
```

#### 响应示例

```json
{
  "success": true,
  "data": {
    "analysisId": "resume_20240115_001",
    "basicInfo": {
      "name": "张三",
      "email": "zhangsan@example.com",
      "phone": "13800138000",
      "education": "本科",
      "experience": "3年"
    },
    "skills": [
      {
        "category": "编程语言",
        "items": ["JavaScript", "Python", "Java"],
        "level": "熟练"
      },
      {
        "category": "框架技术",
        "items": ["React", "Vue.js", "Node.js"],
        "level": "熟练"
      }
    ],
    "workExperience": [
      {
        "company": "ABC科技有限公司",
        "position": "前端开发工程师",
        "duration": "2021.06 - 2024.01",
        "description": "负责公司官网和管理系统的前端开发"
      }
    ],
    "matchAnalysis": {
      "overallScore": 85,
      "skillMatch": 90,
      "experienceMatch": 80,
      "educationMatch": 85,
      "details": {
        "strengths": [
          "技术栈匹配度高",
          "项目经验丰富",
          "学习能力强"
        ],
        "weaknesses": [
          "缺少大型项目经验",
          "团队管理经验不足"
        ],
        "suggestions": [
          "可以补充一些大型项目经验",
          "建议参与团队协作项目"
        ]
      }
    },
    "aiSummary": "候选人技术能力较强，具备扎实的前端开发基础...",
    "recommendation": "推荐面试",
    "confidence": 0.92
  },
  "message": "简历分析完成",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### 错误响应示例

```json
{
  "success": false,
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "文件大小超过限制",
    "details": "文件大小不能超过10MB"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 面试分析 API

### 1. 面试分析接口

#### 接口信息
- **URL**: `/interview-analyze`
- **方法**: `POST`
- **内容类型**: `application/json`
- **描述**: 分析面试记录并生成评估报告

#### 请求参数

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| candidateName | String | 是 | 候选人姓名 |
| position | String | 是 | 面试岗位 |
| interviewType | String | 是 | 面试类型（technical/hr/comprehensive） |
| interviewContent | String | 是 | 面试记录内容 |
| interviewerNotes | String | 否 | 面试官备注 |
| duration | Number | 否 | 面试时长（分钟） |
| language | String | 否 | 分析语言（zh/en），默认zh |

#### 请求示例

```javascript
const requestData = {
  candidateName: "李四",
  position: "Java开发工程师",
  interviewType: "technical",
  interviewContent: `
    问：请介绍一下Spring框架的核心特性？
    答：Spring框架的核心特性包括IoC控制反转、AOP面向切面编程...
    
    问：如何优化数据库查询性能？
    答：可以通过添加索引、优化SQL语句、使用缓存等方式...
  `,
  interviewerNotes: "候选人回答较为流畅，技术基础扎实",
  duration: 45,
  language: "zh"
};

fetch('/api/interview-analyze', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-token'
  },
  body: JSON.stringify(requestData)
})
.then(response => response.json())
.then(data => console.log(data));
```

#### 响应示例

```json
{
  "success": true,
  "data": {
    "analysisId": "interview_20240115_001",
    "candidateInfo": {
      "name": "李四",
      "position": "Java开发工程师",
      "interviewType": "technical",
      "duration": 45
    },
    "evaluation": {
      "overallScore": 82,
      "dimensions": {
        "technicalSkills": {
          "score": 85,
          "details": "技术基础扎实，对Spring框架理解深入"
        },
        "communication": {
          "score": 80,
          "details": "表达清晰，逻辑性较强"
        },
        "problemSolving": {
          "score": 78,
          "details": "能够提出合理的解决方案"
        },
        "experience": {
          "score": 85,
          "details": "项目经验丰富，实践能力强"
        }
      }
    },
    "strengths": [
      "技术基础扎实",
      "项目经验丰富",
      "学习能力强",
      "沟通表达清晰"
    ],
    "weaknesses": [
      "对新技术的了解有限",
      "缺少架构设计经验"
    ],
    "suggestions": [
      "建议深入学习微服务架构",
      "可以参与更多技术分享",
      "加强系统设计能力"
    ],
    "recommendation": {
      "decision": "推荐录用",
      "confidence": 0.88,
      "reasoning": "候选人技术能力符合岗位要求，具备良好的发展潜力"
    },
    "aiSummary": "候选人在技术面试中表现良好，具备扎实的Java开发基础..."
  },
  "message": "面试分析完成",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 通用接口

### 1. 健康检查

#### 接口信息
- **URL**: `/health`
- **方法**: `GET`
- **描述**: 检查API服务状态

#### 响应示例
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "uptime": 3600,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### 2. 获取分析历史

#### 接口信息
- **URL**: `/analysis-history`
- **方法**: `GET`
- **描述**: 获取用户的分析历史记录

#### 查询参数
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| type | String | 否 | 分析类型（resume/interview） |
| page | Number | 否 | 页码，默认1 |
| limit | Number | 否 | 每页数量，默认10 |
| startDate | String | 否 | 开始日期（YYYY-MM-DD） |
| endDate | String | 否 | 结束日期（YYYY-MM-DD） |

#### 响应示例
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "id": "resume_20240115_001",
        "type": "resume",
        "candidateName": "张三",
        "position": "前端开发工程师",
        "score": 85,
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

## 错误代码说明

| 错误代码 | 描述 | 解决方案 |
|----------|------|----------|
| INVALID_FILE_FORMAT | 不支持的文件格式 | 请上传PDF、DOC、DOCX或TXT格式的文件 |
| FILE_TOO_LARGE | 文件过大 | 请上传小于10MB的文件 |
| MISSING_REQUIRED_FIELD | 缺少必填字段 | 请检查请求参数 |
| INVALID_TOKEN | 无效的认证令牌 | 请重新登录获取有效令牌 |
| RATE_LIMIT_EXCEEDED | 请求频率过高 | 请稍后再试 |
| AI_SERVICE_UNAVAILABLE | AI服务不可用 | 请稍后重试或联系技术支持 |
| INTERNAL_SERVER_ERROR | 服务器内部错误 | 请联系技术支持 |

## SDK 示例

### JavaScript SDK

```javascript
class RecruitmentAnalyzer {
  constructor(apiKey, baseUrl = 'https://your-domain.vercel.app/api') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async analyzeResume(file, options = {}) {
    const formData = new FormData();
    formData.append('file', file);
    
    Object.keys(options).forEach(key => {
      formData.append(key, options[key]);
    });

    const response = await fetch(`${this.baseUrl}/resume-analyze`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: formData
    });

    return await response.json();
  }

  async analyzeInterview(data) {
    const response = await fetch(`${this.baseUrl}/interview-analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(data)
    });

    return await response.json();
  }

  async getHistory(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${this.baseUrl}/analysis-history?${queryString}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    return await response.json();
  }
}

// 使用示例
const analyzer = new RecruitmentAnalyzer('your-api-key');

// 分析简历
const resumeResult = await analyzer.analyzeResume(file, {
  position: '前端开发工程师',
  language: 'zh'
});

// 分析面试
const interviewResult = await analyzer.analyzeInterview({
  candidateName: '张三',
  position: '前端开发工程师',
  interviewType: 'technical',
  interviewContent: '面试记录内容...'
});
```

## 最佳实践

### 1. 文件上传优化
- 建议使用PDF格式的简历文件
- 确保文件内容清晰可读
- 避免上传扫描件或图片格式

### 2. 面试记录规范
- 使用结构化的问答格式
- 包含完整的对话内容
- 添加面试官的观察和备注

### 3. 错误处理
- 始终检查响应的success字段
- 根据错误代码进行相应处理
- 实现重试机制处理临时性错误

### 4. 性能优化
- 合理控制请求频率
- 使用分页获取历史记录
- 缓存不变的分析结果

## 更新日志

### v1.0.0 (2024-01-15)
- 初始API版本发布
- 支持简历分析功能
- 支持面试分析功能
- 提供历史记录查询

---

**文档版本**: v1.0.0  
**最后更新**: 2024年1月15日  
**技术支持**: support@example.com