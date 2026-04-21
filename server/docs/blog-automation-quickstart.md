# Blog Automation Quickstart

## 1) Cau hinh bat buoc

Trong `Admin > Cau hinh AI`, can it nhat:

- `apiKey`
- `baseUrl` (mac dinh `https://api.openai.com/v1`)
- `modelChatgpt` (vi du: `gpt-4o`)
- `imageModel` (vi du: `gpt-image-1`)

Neu thieu `apiKey`, job auto-blog se fail va ghi loi trong danh sach jobs.

## 2) Bien moi truong khuyen nghi

Them vao `server/.env`:

```env
BLOG_AUTOMATION_ENABLED=true
BLOG_AUTOMATION_INTERVAL_MS=30000
BLOG_AUTOMATION_DEDUP_HOURS=24
```

Giai thich:
- `BLOG_AUTOMATION_ENABLED=false` de tat scheduler.
- `BLOG_AUTOMATION_INTERVAL_MS` la chu ky quet job/rule.
- `BLOG_AUTOMATION_DEDUP_HOURS` la cua so chan topic trung.

## 3) Luong su dung nhanh trong Admin

### Tao bai ngay lap tuc

1. Vao `Blog tu dong`.
2. Nhap `topic`, `keywords`, `wordCount`.
3. Bo trong `scheduledFor`.
4. Chon `publishMode`:
  - `publish`: dang ngay.
  - `draft`: tao ban nhap de duyet.
5. Co the chon them:
  - `modelProvider` (gemini/chatgpt/claude/grok/deepseek),
  - `modelName` (neu muon ep model cu the),
  - `baseUrl` rieng (neu muon override proxy cho job nay).
6. Bam `Tao bai tu dong`.

Ket qua:
- `publish`: tao blog ngay + job `succeeded`.
- `draft`: job `succeeded`, chua tao blog public.

### Publish draft thu cong

1. O danh sach `Automation jobs`, tim job draft.
2. Bam `Publish draft`.
3. Job duoc gan `blogId` va co link mo bai vua tao.

### Hen gio dang 1 lan

1. Nhap thong tin bai.
2. Dat `scheduledFor` theo gio mong muon.
3. Bam tao job.

Ket qua:
- Job vao `pending`.
- Scheduler tu chay khi den gio.

### Rule lap lai hang ngay

1. Tao rule daily (`postingTime`, `timezone`, `topic`...).
2. Chon `publishMode` cho rule.
3. Bat `Active`.

Ket qua:
- Moi ngay den gio, he thong tao 1 job moi.
- Tranh chay trung trong ngay bang `lastRunDate`.

## 4) API nhanh de test

Can header `Authorization: Bearer <adminToken>`.

### Tao bai ngay (draft + dedupe)

`POST /api/blog-auto/generate`

```json
{
  "topic": "xu huong portfolio 2026",
  "objective": "chia se kinh nghiem thuc chien",
  "keywords": ["portfolio", "react", "seo"],
  "wordCount": 1200,
  "modelProvider": "gemini",
  "modelName": "gemini-2.5-flash",
  "baseUrl": "https://proxy-cua-ban/v1",
  "publishMode": "draft",
  "allowDuplicate": false
}
```

### Tao bai hen gio

```json
{
  "topic": "web performance cho doanh nghiep nho",
  "scheduledFor": "2026-04-22T08:00:00+07:00",
  "keywords": ["core web vitals", "seo"],
  "modelProvider": "chatgpt",
  "modelName": "gpt-4.1-mini",
  "publishMode": "publish"
}
```

### Xem jobs

`GET /api/blog-auto/jobs?limit=20`

### Chay lai 1 job

`POST /api/blog-auto/jobs/:id/run`

### Publish draft tu job

`POST /api/blog-auto/jobs/:id/publish-draft`

### Tao rule

`POST /api/blog-auto/rules`

```json
{
  "name": "Daily SEO",
  "topic": "cac bai huong dan seo co ban",
  "keywords": ["seo", "content"],
  "wordCount": 1000,
  "modelProvider": "claude",
  "modelName": "claude-sonnet-4-6",
  "baseUrl": "https://proxy-cua-ban/v1",
  "publishMode": "publish",
  "postingTime": "08:00",
  "timezone": "Asia/Ho_Chi_Minh",
  "isActive": true
}
```

## 5) Xu ly su co

- Job fail voi loi model:
  - Kiem tra `modelChatgpt` va `imageModel` trong AI settings.
- Job fail voi loi auth:
  - Kiem tra `apiKey`.
- Rule khong chay:
  - Kiem tra `isActive=true`.
  - Kiem tra `postingTime` dung `HH:mm`.
  - Kiem tra server clock/timezone.
  - Co the bam `Tick Scheduler` de trigger thu cong.
- Bao loi topic trung:
  - doi topic moi,
  - hoac bat `allowDuplicate=true`,
  - hoac giam `BLOG_AUTOMATION_DEDUP_HOURS`.
