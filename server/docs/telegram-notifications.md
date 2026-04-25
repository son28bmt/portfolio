# Telegram Notifications

## Muc tieu

Gui cap nhat van hanh quan trong ve bot Telegram de admin theo doi nhanh ma khong can luon mo admin panel.

## Bien moi truong

Them vao `server/.env`:

```env
TELEGRAM_NOTIFICATIONS_ENABLED=true
TELEGRAM_BOT_TOKEN=123456789:AA...
TELEGRAM_CHAT_ID=-100xxxxxxxxxx
TELEGRAM_MESSAGE_THREAD_ID=
```

## Y nghia

- `TELEGRAM_NOTIFICATIONS_ENABLED`
  Bat/tat toan bo notify Telegram. Dat `false` de tat mem.
- `TELEGRAM_BOT_TOKEN`
  Token bot lay tu BotFather.
- `TELEGRAM_CHAT_ID`
  Chat ID hoac group/supergroup ID se nhan notify.
- `TELEGRAM_MESSAGE_THREAD_ID`
  Tuy chon. Dung khi group la forum topic va muon day vao dung thread.

## Su kien dang gui

- Don hang moi duoc tao
- Don hang da thanh toan va dang xu ly
- Don hang hoan thanh
- Don hang bi treo do vi supplier khong du tien
- Blog moi dang tu admin
- Blog tu dong publish tu automation
- Blog duoc cap nhat
- Du an moi dang
- Du an duoc cap nhat
- Co luot tai APK / iOS cua du an
- Nap quy thanh cong

## Nguyen tac ky thuat

- Notify Telegram la `fail-safe`
- Neu bot loi, timeout hoac thieu config thi khong duoc lam hong flow chinh
- Message duoc gui bat dong bo, chi log loi ra server

## Goi y van hanh

- Tao rieng mot group Telegram cho log van hanh
- Neu dung forum topic, nen tao topic rieng cho:
  - don hang
  - blog / du an
  - quy / thanh toan
- Neu chua muon tach topic, co the de trong `TELEGRAM_MESSAGE_THREAD_ID`
