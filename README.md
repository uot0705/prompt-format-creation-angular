# Prompt Format Creation (Angular)

このリポジトリは、フォーム入力をもとにプロンプトを作成・プレビューするAngularアプリです。

## 環境構築

1. Node.js を用意する（LTS 推奨）
2. 依存関係をインストール

```bash
npm install
```

## 開発中の確認

```bash
npm start
```

ブラウザで表示して動作を確認できます。  
※この時点では build は不要です。

## テスト

```bash
npm run test
```

## ビルドが必要なタイミング

- GitHub Pages などに公開する前は build が必要です。
- ローカルでの開発中は不要です。

公開用ビルド:

```bash
npm run build:gh-pages
```

`docs/` に成果物が出力されます。GitHub Pages を `docs/` で公開している場合は、`src/` と `docs/` を一緒にコミットしてください。
