# Blog Automation Workflow (Phase 1)

## Muc tieu

Xay dung luong tu dong tao bai blog tu AI, tao anh cover bang AI, va dang bai theo:

- Trigger thu cong tu Admin (nhap chu de -> tao bai ngay).
- Trigger hen gio mot lan (scheduled job).
- Trigger lap lai hang ngay theo gio (automation rule).

Phase 1 uu tien "chay duoc ngay", de mo rong sang full workflow sau:
- duyet bai,
- A/B title,
- seo scoring,
- retry policy nang cao,
- queue worker rieng (BullMQ/Redis).

Cap nhat hien tai (Phase 1.5):
- Co `publishMode` (`publish` hoac `draft`) cho job/rule.
- Co endpoint publish draft thu cong tu job.
- Co duplicate guard theo topic trong khoang thoi gian ngan.

## Kien truc tong quan

1. Admin UI tao yeu cau.
2. Backend tao `BlogAutomationJob` (pending/running/succeeded/failed).
3. Job runner:
   - goi AI text de sinh title/excerpt/content/tags,
   - goi AI image de tao cover image,
   - tao ban ghi `Blog`.
4. Scheduler:
   - quet job den han de chay,
   - quet rule hang ngay de tao job moi.

## Models moi

### `BlogAutomationRule`

Dung cho lich dang lap lai hang ngay.

- `id` (UUID)
- `name` (STRING, required)
- `publishMode` (`publish` | `draft`)
- `modelProvider` (`chatgpt` | `gemini` | `claude` | `grok` | `deepseek`)
- `modelName` (STRING, optional override model cu the)
- `baseUrl` (TEXT, optional override qua proxy rieng)
- `topic` (TEXT, required)
- `objective` (TEXT)
- `tone` (STRING)
- `targetAudience` (STRING)
- `keywords` (JSON array string)
- `wordCount` (INTEGER)
- `postingTime` (STRING, dinh dang `HH:mm`)
- `timezone` (STRING, vd `Asia/Ho_Chi_Minh`)
- `isActive` (BOOLEAN)
- `lastRunDate` (DATEONLY, theo timezone cua rule)

### `BlogAutomationJob`

Dung cho tat ca viec tao bai (manual + scheduled + tu rule).

- `id` (UUID)
- `sourceType` (`manual` | `rule`)
- `publishMode` (`publish` | `draft`)
- `modelProvider` (`chatgpt` | `gemini` | `claude` | `grok` | `deepseek`)
- `modelName` (STRING, optional override model cu the)
- `baseUrl` (TEXT, optional override qua proxy rieng)
- `ruleId` (UUID, nullable)
- `topic` (TEXT, required)
- `objective` (TEXT)
- `tone` (STRING)
- `targetAudience` (STRING)
- `keywords` (JSON array string)
- `wordCount` (INTEGER)
- `scheduledFor` (DATE)
- `status` (`pending` | `running` | `succeeded` | `failed`)
- `errorMessage` (TEXT)
- `blogId` (UUID, nullable)
- `startedAt` (DATE)
- `finishedAt` (DATE)
- `meta` (JSON)
  - draft payload (neu `publishMode=draft`)
  - model da dung
  - duplicate window da ap dung

## API (Phase 1)

Base path: `/api/blog-auto`

### 1) Tao bai AI (immediate hoac schedule)

`POST /generate`

Body:

```json
{
  "topic": "xu huong xay dung portfolio 2026",
  "objective": "huong dan nguoi moi",
  "tone": "than thien, thuc chien",
  "targetAudience": "frontend developer",
  "keywords": ["portfolio", "react", "seo"],
  "wordCount": 1200,
  "modelProvider": "gemini",
  "modelName": "gemini-2.5-flash",
  "baseUrl": "https://proxy-cua-ban/v1",
  "publishMode": "draft",
  "allowDuplicate": false,
  "scheduledFor": "2026-04-22T08:00:00+07:00"
}
```

Quy tac:
- Neu `scheduledFor` trong tuong lai: tao `pending job`.
- Neu khong co `scheduledFor` hoac <= hien tai: chay job ngay, tao blog ngay.
- Neu `publishMode=draft`: job `succeeded` nhung chua tao blog public.

### 2) Danh sach jobs

`GET /jobs?limit=20`

Tra ve danh sach moi nhat de admin theo doi trang thai.

### 3) Danh sach rules

`GET /rules`

### 4) Tao rule hang ngay

`POST /rules`

Body:

```json
{
  "name": "Daily AI/SEO",
  "topic": "chu de cot loi web va AI",
  "objective": "xay trust va thu hut lead",
  "tone": "chuyen nghiep de hieu",
  "targetAudience": "chu doanh nghiep vua va nho",
  "keywords": ["ai", "website", "marketing"],
  "wordCount": 1000,
  "modelProvider": "claude",
  "modelName": "claude-sonnet-4-6",
  "baseUrl": "https://proxy-cua-ban/v1",
  "publishMode": "draft",
  "postingTime": "08:00",
  "timezone": "Asia/Ho_Chi_Minh",
  "isActive": true
}
```

### 5) Cap nhat rule

`PUT /rules/:id`

Ho tro:
- bat/tat (`isActive`),
- thay doi gio dang,
- thay doi chu de/prompt.

### 6) Xoa rule

`DELETE /rules/:id`

### 7) Publish draft tu job

`POST /jobs/:id/publish-draft`

Dieu kien:
- Job phai `succeeded`
- Job chua co `blogId`
- Job co `meta.draft`

## Scheduler behavior

- Chay theo interval (mac dinh 30s).
- Moi lan tick:
  1. Xu ly `pending jobs` den han (`scheduledFor <= now`).
  2. Quet `active rules`, neu dung `postingTime` theo `timezone` va chua chay hom nay (`lastRunDate`) thi tao 1 pending job moi.

Co lock trong process de tranh chay de quy/trung lap trong cung 1 instance.

## AI generation behavior

Text model:
- Thu tu uu tien:
  1. `job.modelName` (neu gui len API),
  2. model theo `job.modelProvider` trong AI Settings (`ai_model_gemini`, `ai_model_claude`, ...),
  3. fallback `ai_model_chatgpt` / `ai_model`.
- Base URL:
  - `job.baseUrl` (neu co) -> `ai_baseUrl` (trong Setting) -> fallback.
- API key:
  - `ai_apiKey`

Image model:
- `ai_image_model` (neu co), fallback `gpt-image-1`.

Output schema mong muon tu AI text:

```json
{
  "title": "...",
  "excerpt": "...",
  "readTime": "7 min",
  "tags": ["tag1", "tag2"],
  "coverImagePrompt": "...",
  "contentHtml": "<h2>...</h2><p>...</p>"
}
```

Neu image generation fail:
- fallback anh placeholder de job van thanh cong.

## Duplicate Guard

- Mac dinh block tao job neu topic trung voi bai/job gan day trong `24h`.
- Co the doi window qua env:
  - `BLOG_AUTOMATION_DEDUP_HOURS=24`
- Manual API co `allowDuplicate=true` de bo qua guard.

## Ranh gioi va ke hoach tiep theo

### Da co o Phase 1
- Auto write + auto cover + auto publish.
- Schedule 1 lan.
- Daily recurring rule.
- Job tracking.

### Nen lam tiep (Phase 2)
- Them che do draft/review truoc khi publish.
- Add content safety + duplicate detection.
- Add queue worker (BullMQ) neu scale lon.
- Add chi phi/token tracking va budget cap.
- Add webhook/telegram notify khi job fail.
