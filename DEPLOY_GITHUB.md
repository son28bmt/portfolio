# Deploy tự động bằng GitHub (không cần upload file thủ công)

## 1) Chuẩn bị repo GitHub

Nếu project local chưa là git repo:

```bash
cd e:\portfolio
git init
git branch -M main
git add .
git commit -m "Initial commit"
git remote add origin git@github.com:<username>/<repo>.git
git push -u origin main
```

`<username>/<repo>` thay bằng repo của bạn.

## 2) Chuẩn bị server (1 lần)

SSH vào server:

```bash
mkdir -p /www/wwwroot
cd /www/wwwroot
git clone git@github.com:<username>/<repo>.git api.nguyenquangson.id.vn
cd /www/wwwroot/api.nguyenquangson.id.vn
bash scripts/deploy.sh
```

Nếu repo private và clone bằng SSH, cần add deploy key trên server vào GitHub.

## 3) Tạo GitHub Secrets

Vào `GitHub Repo -> Settings -> Secrets and variables -> Actions -> New repository secret` và thêm:

- `DEPLOY_HOST` = IP server (ví dụ `103.166.182.121`)
- `DEPLOY_USER` = user SSH (thường `root` hoặc user deploy)
- `DEPLOY_SSH_KEY` = private key SSH dùng để đăng nhập server
- `DEPLOY_PORT` = `22` (hoặc port SSH custom)
- `APP_ROOT` = `/www/wwwroot/api.nguyenquangson.id.vn`
- `DEPLOY_BRANCH` = `main`
- `GIT_REPO_URL` = `git@github.com:<username>/<repo>.git` (có thể để trống nếu server đã clone sẵn)
- `SERVER_DIR` = `/www/wwwroot/api.nguyenquangson.id.vn/server`
- `CLIENT_DIR` = `/www/wwwroot/api.nguyenquangson.id.vn/client`
- `ADMIN_DIR` = `/www/wwwroot/api.nguyenquangson.id.vn/admin`
- `CLIENT_WEB_ROOT` = `/www/wwwroot/nguyenquangson.id.vn`
- `ADMIN_WEB_ROOT` = `/www/wwwroot/admin.nguyenquangson.id.vn`
- `API_RESTART_CMD` = `pm2 restart server` (hoặc lệnh restart bạn đang dùng trong aaPanel)
- `HEALTHCHECK_URL` = `https://api.nguyenquangson.id.vn/api/ping`

## 4) Cách chạy deploy

Bạn đã có workflow: `.github/workflows/deploy.yml`

- Mỗi lần push `main`: tự deploy.
- Hoặc vào `GitHub Actions -> Deploy Production -> Run workflow`.

## 5) Kiểm tra sau deploy

- `https://api.nguyenquangson.id.vn/api/ping`
- `https://nguyenquangson.id.vn`
- `https://admin.nguyenquangson.id.vn`

Nếu API không tự restart đúng, đổi secret `API_RESTART_CMD` sang đúng lệnh restart thực tế trên server.
