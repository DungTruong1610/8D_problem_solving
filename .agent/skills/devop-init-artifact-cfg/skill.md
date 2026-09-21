---
name: devop-init-artifact-cfg
description: |
  Sets up Azure DevOps Artifacts for npm by auto-generating a .npmrc file
  with correct registry URL, scope, and base64-encoded PAT credentials —
  so developers can run npm install for private packages immediately.

  Trigger this skill when user mentions any of the following:
  Vietnamese: setup npmrc, azure artifact, lỗi 401 npm, PAT npm, cấu hình registry
  English: setup .npmrc azure devops, 401 on npm install, azure artifacts npm, private registry PAT
  German: npmrc einrichten, azure devops npm konfigurieren, privates npm-paket, PAT npm-fehler

  Also trigger when: cloning a new project and needing npm auth, getting E401/E403 errors
  on scoped packages, or wanting to publish/consume packages from Azure Artifacts feed.
metadata:
  version: 1.1.0
  author: Leo
---

# Skill: devop-init-artifact-cfg

Automates `.npmrc` setup for Azure DevOps Artifacts — no more copy-pasting
credentials manually for each project.

Supports: 🇻🇳 Vietnamese · 🇬🇧 English · 🇩🇪 German

---

## Step 0 — Detect Language

Before anything else, detect the user's language from their message:

- If the message is in **Vietnamese** → respond entirely in Vietnamese (use "Anh/chị")
- If the message is in **English** → respond entirely in English
- If the message is in **German** → respond entirely in German (use "Sie" formal form)
- If ambiguous → default to **English**

Apply this language to ALL messages, question labels, confirmations, and output text
throughout the entire skill execution. Never mix languages mid-flow.

---

## Step 1 — Collect Registry Config

Use `AskUserQuestion` with up to 3 questions in one call.
**Phrase all labels and descriptions in the detected language.**

| Field | Default | Header label (VI / EN / DE) |
|-------|---------|------------------------------|
| Azure DevOps Org | `conarumdc` | Tổ chức / Org name / Organisation |
| Feed name | `cdk-npm` | Feed / Feed / Feed |
| npm Scope | `@cnma` | Scope / Scope / Scope |

For each field, offer:
- Option 1: the default value (mark as Recommended)
- Option 2: "Other / Khác / Andere" → follow up with a plain-text question to get the custom value

**Example (English):**
```
Q1: "What is your Azure DevOps organization name?"
  options: ["conarumdc (Recommended)", "Other (type manually)"]
Q2: "Which Artifacts feed are you using?"
  options: ["cdk-npm (Recommended)", "Other (type manually)"]
Q3: "What is the npm scope for your packages?"
  options: ["@cnma (Recommended)", "Other (type manually)"]
```

**Example (Vietnamese):**
```
Q1: "Azure DevOps Organization name là gì?"
  options: ["conarumdc (Mặc định)", "Khác (nhập tay)"]
Q2: "Tên Feed trong Artifacts?"
  options: ["cdk-npm (Mặc định)", "Khác (nhập tay)"]
Q3: "npm Scope của packages?"
  options: ["@cnma (Mặc định)", "Khác (nhập tay)"]
```

**Example (German):**
```
Q1: "Wie lautet Ihr Azure DevOps-Organisationsname?"
  options: ["conarumdc (Empfohlen)", "Andere (manuell eingeben)"]
Q2: "Welchen Artifacts-Feed verwenden Sie?"
  options: ["cdk-npm (Empfohlen)", "Andere (manuell eingeben)"]
Q3: "Was ist der npm-Scope Ihrer Pakete?"
  options: ["@cnma (Empfohlen)", "Andere (manuell eingeben)"]
```

---

## Step 2 — Collect Credentials & File Location

Use `AskUserQuestion` in one call for:

**Q1 — File location** (where to create .npmrc):

| Language | Question | Option A | Option B |
|----------|----------|----------|----------|
| VI | ".npmrc cần tạo ở đâu?" | "Local — trong project hiện tại (Khuyến nghị)" | "Global — ~/.npmrc" |
| EN | "Where should .npmrc be created?" | "Local — current project only (Recommended)" | "Global — ~/.npmrc for all projects" |
| DE | "Wo soll die .npmrc erstellt werden?" | "Lokal — nur dieses Projekt (Empfohlen)" | "Global — ~/.npmrc für alle Projekte" |

**Option descriptions:**
- Local: credential stays in this project folder only; must be added to .gitignore
- Global: applies to all projects on this machine; convenient but less isolated

**PAT — Handle separately (NOT via AskUserQuestion):**
PAT is sensitive — do not include it in multiple-choice UI. Instead, after the above
question, write a message asking the user to paste their PAT directly into chat:

- VI: "Anh/chị vui lòng paste **PAT (Personal Access Token)** Azure DevOps vào đây. Token chỉ dùng để tạo .npmrc và không được lưu nơi nào khác."
- EN: "Please paste your Azure DevOps **PAT (Personal Access Token)** here. It will only be used to generate .npmrc and won't be stored anywhere."
- DE: "Bitte fügen Sie Ihren Azure DevOps **PAT (Personal Access Token)** hier ein. Er wird nur zur Erstellung der .npmrc verwendet und nicht gespeichert."

Wait for PAT input, then ask for **email** the same way (plain message, not AskUserQuestion):
- VI: "Email đăng ký Azure DevOps của anh/chị?"
- EN: "Your Azure DevOps registered email address?"
- DE: "Ihre bei Azure DevOps registrierte E-Mail-Adresse?"

**If the user doesn't have a PAT yet**, show the full step-by-step guide in their language:

---

### 🇻🇳 Hướng dẫn tạo PAT (Vietnamese)

> "Anh/chị chưa có PAT? Em hướng dẫn tạo nhé — chỉ mất 1 phút:"

**Bước 1 — Vào trang quản lý token:**
Truy cập link sau (thay `{org}` bằng tên tổ chức):
```
https://dev.azure.com/{org}/_usersSettings/tokens
```
Hoặc vào thủ công: **Azure DevOps → góc trên phải → avatar → Personal Access Tokens**

**Bước 2 — Tạo token mới:**
- Nhấn **"New Token"** (nút xanh góc phải)
- **Name:** đặt tên dễ nhớ, ví dụ `npm-local-machine`
- **Organization:** chọn đúng org (`{org}`)
- **Expiration:** khuyến nghị **90 ngày** (có thể gia hạn sau)
- **Scopes:** chọn **"Custom defined"** → tìm mục **Packaging** → tick **Read** (nếu chỉ install) hoặc **Read & Write** (nếu cần publish)

**Bước 3 — Copy token:**
- Nhấn **"Create"**
- **Copy token ngay lập tức** — Azure DevOps chỉ hiện token 1 lần duy nhất, đóng tab là mất
- Paste vào chat để em tiếp tục setup

---

### 🇬🇧 PAT Creation Guide (English)

> "Don't have a PAT yet? Here's how to create one — takes about a minute:"

**Step 1 — Open token management:**
Go to:
```
https://dev.azure.com/{org}/_usersSettings/tokens
```
Or manually: **Azure DevOps → top-right avatar → Personal Access Tokens**

**Step 2 — Create a new token:**
- Click **"New Token"** (blue button, top right)
- **Name:** something recognizable, e.g. `npm-local-machine`
- **Organization:** select the correct org (`{org}`)
- **Expiration:** 90 days recommended (can be renewed)
- **Scopes:** select **"Custom defined"** → find **Packaging** → check **Read** (install only) or **Read & Write** (if you also publish)

**Step 3 — Copy the token:**
- Click **"Create"**
- **Copy the token immediately** — Azure DevOps shows it only once; closing the tab means it's gone
- Paste it into the chat to continue

---

### 🇩🇪 PAT erstellen (German)

> "Sie haben noch kein PAT? Hier ist eine Schritt-für-Schritt-Anleitung — dauert etwa eine Minute:"

**Schritt 1 — Token-Verwaltung öffnen:**
Navigieren Sie zu:
```
https://dev.azure.com/{org}/_usersSettings/tokens
```
Oder manuell: **Azure DevOps → Avatar oben rechts → Personal Access Tokens**

**Schritt 2 — Neues Token erstellen:**
- Klicken Sie auf **„New Token"** (blauer Button oben rechts)
- **Name:** z. B. `npm-local-machine`
- **Organization:** korrekte Organisation auswählen (`{org}`)
- **Expiration:** 90 Tage empfohlen (kann verlängert werden)
- **Scopes:** **„Custom defined"** wählen → **Packaging** suchen → **Read** aktivieren (nur installieren) oder **Read & Write** (wenn auch veröffentlicht wird)

**Schritt 3 — Token kopieren:**
- Auf **„Create"** klicken
- **Token sofort kopieren** — Azure DevOps zeigt ihn nur einmal; nach dem Schließen des Tabs ist er weg
- Token in den Chat einfügen, um fortzufahren

---

---

## Step 3 — Generate .npmrc

Run the bundled Python script to create the file:

```bash
python3 "{skill_dir}/scripts/generate_npmrc.py" \
  --org "{org}" \
  --feed "{feed}" \
  --scope "{scope}" \
  --username "{username_or_email}" \
  --pat "{PAT}" \
  --email "{email}" \
  --target "{local|global}" \
  --project-dir "{workspace_folder_path}" \
  --force
```

> **Finding skill_dir:** This is the directory containing this SKILL.md file.
> If unsure, run: `find ~/.claude/skills -name "generate_npmrc.py" 2>/dev/null`

The script will:
1. Base64-encode the PAT automatically
2. Build the correct .npmrc content
3. Write the file (use `--force` since overwrite confirmation was already handled by Claude)
4. Print the file contents with PAT masked (shows `_password=<base64-encoded-PAT>`)

**Important:** Do not print or log the raw PAT at any point.

---

## Step 4 — Post-Setup & Verification

After successful file creation, tell the user (in their language):

**1. File location confirmation**
Show exactly where the file was created.

**2. .gitignore warning (local only)**
If local target, check if `.npmrc` is already in `.gitignore`. If not, offer to add it:

```bash
echo '.npmrc' >> .gitignore
```

- VI: "File .npmrc chứa credentials — nên thêm vào .gitignore để tránh commit lên git. Em có thể thêm luôn không?"
- EN: ".npmrc contains credentials — it should be added to .gitignore to avoid committing it. Should I add it now?"
- DE: "Die .npmrc enthält Zugangsdaten und sollte in .gitignore aufgenommen werden. Soll ich das jetzt tun?"

**3. Verification offer**
Offer to run a quick test if a `package.json` exists in the project:

```bash
npm install --dry-run
```

- VI: "Anh/chị muốn em chạy thử `npm install --dry-run` để kiểm tra kết nối không?"
- EN: "Want me to run `npm install --dry-run` to verify the connection works?"
- DE: "Soll ich `npm install --dry-run` ausführen, um die Verbindung zu testen?"

Report the result and flag any auth errors (E401/E403) with troubleshooting tips.

---

## Reference: .npmrc Format

The generated file always follows this exact structure:

```
{scope}:registry=https://pkgs.dev.azure.com/{org}/_packaging/{feed}/npm/registry/
always-auth=true
//pkgs.dev.azure.com/{org}/_packaging/{feed}/npm/registry/:username={username}
//pkgs.dev.azure.com/{org}/_packaging/{feed}/npm/registry/:_password={BASE64_PAT}
//pkgs.dev.azure.com/{org}/_packaging/{feed}/npm/registry/:email={email}
install-links=true
```

`_password` must be the **base64-encoded** PAT — not the raw token.
This is required because npm uses HTTP Basic Auth, which expects base64 in the password field.

---

## Files

```
devop-init-artifact-cfg/
├── SKILL.md                  ← This file
└── scripts/
    └── generate_npmrc.py     ← Generates and writes .npmrc
```
