---
title: Auto Deploy Laravel via GitHub Actions (Tanpa Docker)
description: Rangkuman cara auto deploy laravael via github action tanpa docker
layout: "home"
# sidebar: false
---

# Auto Deploy Laravel via GitHub Actions (Tanpa Docker)

Ini adalah rangkuman lengkap tentang cara melakukan auto deploy Laravel menggunakan GitHub Actions tanpa Docker. Saya membuat ini dengan bantuan chatGPT, termasuk rangkuman yang akan kamu di bawah ini.

## 🎯 Tujuan Akhir:

- Laravel app ter-deploy otomatis setiap push ke branch `prod`
- Server ringan (RAM 2GB), tidak menggunakan Docker
- User `deploy` non-root, tanpa password
- Aman dan terpisah antara:
  - SSH key untuk **GitHub → Server**
  - SSH key untuk **Server → GitHub**

- Support multiple repository dengan key & remote berbeda

---

## 🧱 1. Membuat User `deploy` di Server

```bash
sudo adduser --disabled-password --gecos "" deploy
```

> Ini membuat user `deploy` tanpa password login dan tanpa sudo secara default.

---

## 🔐 2. Setup SSH Key untuk **GitHub Actions → Server** (akses SSH)

### Di lokal:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy_key -C "github-deploy"
```

- **Upload private key** ke GitHub Repo:
  - `Settings → Secrets → Actions → SSH_PRIVATE_KEY`
  - Value: isi dari `github_deploy_key` (private)

- **Tempatkan public key di server (user `deploy`):**

```bash
sudo mkdir -p /home/deploy/.ssh
sudo nano /home/deploy/.ssh/authorized_keys
# Paste isi github_deploy_key.pub
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

---

## 🗝️ 3. Setup SSH Key untuk **Server → GitHub** (akses `git pull`)

### Di server (user `deploy`):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_repo_x -C "server-github"
chmod 600 ~/.ssh/id_ed25519_repo_x
```

- **Tambahkan public key `id_ed25519_repo_x.pub` ke GitHub repo:**

  > Repo → Settings → Deploy Keys → Add Deploy Key
  > ✅ Centang _Allow write access_ jika perlu

---

## ⚙️ 4. Konfigurasi SSH Client (`~/.ssh/config`) untuk Multi Repo

```ini
# Repo 1
Host repo.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_repo
  IdentitiesOnly yes
```

> Bisa ditambahkan lagi untuk repo lain:

```ini
# Repo Kasir
Host kasir.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_kasir
  IdentitiesOnly yes
```

---

## 🔗 5. Ubah Git Remote ke Alias yang Sesuai

### Contoh:

```bash
cd /var/www/your-repo
git remote set-url origin git@your-repo:username/repo.git
```

`your-repo` adalah nama repomu bisa akan dibuat alias untuk remote ssh.

> Harus sesuai dengan `Host` di SSH config

Verifikasi:

```bash
git remote -v
```

---

## 🔐 6. Tambahkan GitHub ke `known_hosts` di Server

```bash
ssh-keyscan github.com >> ~/.ssh/known_hosts
chmod 644 ~/.ssh/known_hosts
```

> Diperlukan agar `git pull` tidak gagal karena fingerprint unknown.

---

## 📂 7. Atur Akses Folder Laravel untuk User `deploy`

```bash
sudo chown -R deploy:www-data /var/www/your-laravel-project
sudo chmod -R ug+rw /var/www/your-laravel-project
sudo find /var/www/your-laravel-project -type d -exec chmod 775 {} \;
```

---

## 🔒 8. Izinkan `deploy` Restart Queue via `supervisorctl` (Tanpa Password)

```bash
sudo visudo
```

Tambahkan:

```bash
deploy ALL=(ALL) NOPASSWD: /usr/bin/supervisorctl restart queue-all
```

---

## 🔐 9. Tambahkan Secrets di GitHub Repository

| Secret Name          | Value                                |
| -------------------- | ------------------------------------ |
| `SSH_PRIVATE_KEY`    | Private key dari `github_deploy_key` |
| `DEPLOY_SERVER_USER` | `deploy`                             |
| `DEPLOY_SERVER_IP`   | IP server kamu                       |
| `DEPLOY_APP_PATH`    | `/var/www/your-laravel-project`      |

---

## 🚀 10. GitHub Actions Workflow: `.github/workflows/deploy-prod.yml`

```yaml
name: Deploy Laravel to Production

on:
  push:
    branches:
      - prod

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: 📥 Checkout Repo
        uses: actions/checkout@v3

      - name: 🔐 Setup SSH Key
        uses: webfactory/ssh-agent@v0.8.0
        with:
          ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}

      - name: 📡 Add known hosts
        run: |
          ssh-keyscan -H ${{ secrets.DEPLOY_SERVER_IP }} >> ~/.ssh/known_hosts
          ssh-keyscan -H github.com >> ~/.ssh/known_hosts

      - name: 🚀 Deploy to Server
        run: |
          ssh ${{ secrets.DEPLOY_SERVER_USER }}@${{ secrets.DEPLOY_SERVER_IP }} << 'EOF'
            ssh-keyscan github.com >> ~/.ssh/known_hosts

            cd ${{ secrets.DEPLOY_APP_PATH }}
            git pull origin prod

            composer install --no-dev --optimize-autoloader
            pnpm install
            pnpm build

            php artisan migrate --force
            php artisan config:cache
            php artisan route:cache
            php artisan view:cache

            sudo /usr/bin/supervisorctl restart queue-all
            echo "✅ Deployment complete!"
          EOF
```

---

## 🧪 11. Test

- Jalankan:

```bash
ssh -T github-repo-x
```

- Jalankan:

```bash
git pull origin prod
```

- Push ke branch `prod` di GitHub → ✅ GitHub Actions auto-deploy Laravel app ke server

---

## 📦 Hasil Akhir:

| Item                         | Status |
| ---------------------------- | ------ |
| Laravel deployed otomatis    | ✅     |
| Tidak pakai Docker           | ✅     |
| Multi repository support     | ✅     |
| Aman dengan SSH key terpisah | ✅     |
| Non-root user `deploy`       | ✅     |
| Supervisor queue restart     | ✅     |
