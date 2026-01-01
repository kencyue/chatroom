# 線上聊天室

純HTML/JavaScript聊天應用，可直接部署到GitHub Pages。

## 功能特色
- ✅ 動物符號身份識別系統
- ✅ 即時訊息聊天
- ✅ 多頻道支援
- ✅ 使用者管理系統
- ✅ 管理員控制面板
- ✅ 響應式設計
- ✅ 暗色/亮色主題

## 部署步驟

### 1. 設定Firebase
1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 建立新專案
3. 啟用 Firestore 資料庫
4. 設定安全規則：
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // 允許所有讀寫（開發階段）
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
