# Angular 19 を GitHub Pages にアップロードする環境構築方法

## 前提知識
1. **GitHub Pages**  
   GitHub Pages は静的サイトをホスティングするサービスで、Angular アプリをデプロイする際は静的なビルド成果物が必要です。

2. **Angular CLI**  
   Angular CLI は Angular プロジェクトを作成し、ビルドやサーブを簡単に行えるツールです。

3. **必要なツール**  
   - Node.js (LTS推奨)
   - Angular CLI (プロジェクト作成やビルドに使用)
   - Git (リポジトリの管理に使用)

---

## 環境構築のエラー対策

<details>
<summary>エラー: ng: command not found (Angular CLI インストール時)</summary>

### **状況**  
Angular CLI がインストールされていない場合に発生します。

### **解決方法**
以下のコマンドで Angular CLI をグローバルインストールしてください:
```bash
npm install -g @angular/cli
```
</details>

<details>
<summary>エラー: The "server" option is required when "outputMode" is set to "server" (Angular ビルド時)</summary>

### **状況**  
Angular プロジェクトが SSR (サーバーサイドレンダリング) 設定になっている場合に発生します。

### **解決方法**
1. `angular.json`を開き、`"builder": "@angular-devkit/build-angular:browser"`に変更してください。
2. `"main": "src/main.ts"`を正しく指定してください。
</details>

<details>
<summary>エラー: 404 File not found (GitHub Pages デプロイ後)</summary>

### **状況**  
`index.html`が正しい場所に配置されていない場合に発生します。

### **解決方法**
1. ビルドコマンドを以下のように実行してください:
   ```bash
   ng build --output-path docs --base-href /<repository-name>/
   ```
2. `docs`フォルダ直下に`index.html`が生成されていることを確認してください。
</details>

<details>
<summary>エラー: Node.js のバージョンエラー (環境構築時)</summary>

### **状況**  
Node.js のバージョンが適切でない場合に発生します。

### **解決方法**
Node.js のバージョンを LTS に設定してください。以下のコマンドで適切なバージョンをインストールできます:
```bash
nvm install 18
nvm use 18
```
</details>

---

## 環境構築方法

### 1. GitHub リポジトリの作成
1. GitHub 上で新しいリポジトリを作成します。
2. プロジェクト名は自由に設定してください (例: `angular-github-pages-demo`)。

### 2. Angular プロジェクトの作成
以下のコマンドで新しい Angular プロジェクトを作成します:
```bash
ng new <project-name>
```
プロジェクト作成中に以下を選択:
- CSSの選択: `SCSS` (推奨)
- Routing: 必要に応じて選択

### 3. `angular.json`の修正
GitHub Pages に対応するため、以下の設定を行います。

1. `angular.json`を開き、`build`の箇所を以下を修正または追加します:

```json
"build": {
  "builder": "@angular-devkit/build-angular:browser",
  "options": {
    "outputPath": "docs",
    "index": "src/index.html",
    "main": "src/main.ts",
    "polyfills": [
      "zone.js"
    ],
    "tsConfig": "tsconfig.app.json",
    "assets": [
      {
        "glob": "**/*",
        "input": "src/assets",
        "output": "/assets"
      },
      {
        "glob": "favicon.ico",
        "input": "src",
        "output": "/"
      }
    ],
    "styles": [
      "src/styles.scss"
    ],
    "scripts": []
  },
  "configurations": {
    "production": {
      "outputHashing": "all"
    }
  }
}
```

### 4. GitHub Actions 用の設定
以下の内容で `.github/workflows/gh-pages.yml` ファイルを作成します:

```yaml
name: Build and Deploy Angular to GitHub Pages

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: npm install

      - name: Install Angular CLI
        run: npm install -g @angular/cli

      - name: Build Angular app
        run: ng build --output-path docs --base-href /<repository-name>/

      - name: Disable Jekyll
        run: touch docs/.nojekyll

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: docs
```

### 5. GitHub Pages の設定
1. GitHub のリポジトリ設定に移動します。
2. 左メニューの「Pages」をクリックします。
3. Source を「GitHub Actions」に設定します。

### 6. アクセス確認
1. 公開されたURLを確認します。
   ```
   https://<username>.github.io/<repository-name>/
   ```
2. 正しく表示されることを確認してください。
