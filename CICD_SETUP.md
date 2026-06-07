# CI/CD Pipeline Setup Guide
## Silver Service Online

Your CI/CD pipeline is fully configured in GitHub. This guide covers the one-time steps needed to activate it.

---

## What the Pipeline Does

| Trigger | Action |
|---|---|
| Push to any branch / PR opened | Runs tests: syntax check, HTML validation, server smoke test, fare API test |
| PR opened against `main` | Posts an automated CI summary comment on the PR |
| Merge to `main` | Deploys to production server via SSH (zero-downtime PM2 reload) |
| Every Monday 8am AEST | Weekly `npm audit` security scan — alerts you on Telegram if critical CVEs found |

---

## Step 1 — First-Time Server Setup

SSH into your production server and run the setup script:

```bash
ssh ubuntu@silverserviceonline.com.au
curl -s https://raw.githubusercontent.com/springwoodtaxis-arch/silver-service-online/main/scripts/server-setup.sh | bash
```

This installs Node.js 20, PM2, Nginx, clones the repo, and configures everything automatically.

---

## Step 2 — Generate an SSH Deploy Key

Run this on your **local machine**:

```bash
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github_deploy_key -N ""
```

Add the **public key** to your server:
```bash
ssh-copy-id -i ~/.ssh/github_deploy_key.pub ubuntu@silverserviceonline.com.au
```

Copy the **private key** — you'll need it in Step 3:
```bash
cat ~/.ssh/github_deploy_key
```

---

## Step 3 — Add GitHub Repository Secrets

Go to: **GitHub → Repository → Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Value |
|---|---|
| `SSH_PRIVATE_KEY` | Contents of `~/.ssh/github_deploy_key` (the private key) |
| `SERVER_HOST` | `silverserviceonline.com.au` |
| `SERVER_USER` | `ubuntu` (or your server username) |
| `DEPLOY_PATH` | `/var/www/silver-service-online` |
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID |

---

## Step 4 — Activate SSL (HTTPS)

On your server:
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d silverserviceonline.com.au -d www.silverserviceonline.com.au
```

---

## Step 5 — Test the Pipeline

Make any small change (e.g., edit README.md) and push to `main`:

```bash
git add README.md && git commit -m "test: trigger CI/CD" && git push
```

Watch the pipeline run at:
**https://github.com/springwoodtaxis-arch/silver-service-online/actions**

---

## Workflow Files

The workflow files are stored locally in `.github/workflows/` and need to be pushed with a token that has the `workflows` permission scope. See the note below.

> **Note on Workflow Permissions:** GitHub requires a token with `workflows` scope to push `.github/workflows/` files via git push. The workflow files are ready in your local project at `.github/workflows/`. To push them, either:
> 1. Use a **Personal Access Token (Classic)** with `repo` + `workflow` scopes: `git remote set-url origin https://YOUR_PAT@github.com/springwoodtaxis-arch/silver-service-online.git && git push`
> 2. Or upload them manually via GitHub UI: **Repository → Add file → Upload files** → drag and drop the `.github/workflows/` folder

---

## Daily Operations

```bash
# View app logs
pm2 logs silver-service

# Restart app manually
pm2 restart silver-service

# Check app status
pm2 status

# View Nginx logs
sudo tail -f /var/log/nginx/silver-service-error.log
```
