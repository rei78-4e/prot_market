# めぐる団地 — ソースコード

商品写真を単品画像に差し替え、日本語・英語切り替えと大きな残高表示を追加した版です。

## 内容

- `dist/index.html`：画面の入口
- `dist/style.css`：見た目
- `dist/app.js`：サンプルデータ、残高、保存処理など
- `dist/simple.js`：30分予約、現地交換処理、スタッフ管理
- `dist/resident.js`：日本語・英語の住民画面、残高表示
- `dist/assets/`：単品の商品画像6枚（生成したデモ画像）
- `dist/data.js`：初期制作時のデータファイル。現行画面では読み込んでいません。

## 起動

画面の表示自体にビルドは不要です。`dist` を静的Webサーバーで開いてください。
Pythonがある場合、このREADMEのあるフォルダーで以下を実行できます。

```sh
python -m http.server 8080 --directory dist
```

- 日本語： http://localhost:8080/?lang=ja
- 英語： http://localhost:8080/?lang=en

スタッフ管理は日本語のみです。

## Cloudflare Workers への配置

設定は `wrangler.jsonc` です。`dist` を静的アセットとして配信するため、Worker のコードはありません。

- ローカル確認： `npm install` のあと `npm run dev`（http://localhost:8787）
- 手動デプロイ： `npx wrangler login` のあと `npm run deploy`

GitHub 連携の自動デプロイ（Workers Builds）を使う場合：

1. このリポジトリを GitHub に push します（ブランチ `main`）。
2. Cloudflare ダッシュボードの **Workers & Pages** → **Create** → **Import a repository** でリポジトリを選択します。
3. 設定値は次のとおりです。ビルドコマンドは空、デプロイコマンドは `npx wrangler deploy`、ルートディレクトリは `/`、プロダクションブランチは `main`。
4. 以後、`main` への push で自動的にデプロイされます。プレビュービルドを有効にすると、他のブランチはプレビューURLで確認できます。

公開先は `https://meguru-danchi.<アカウントのサブドメイン>.workers.dev` です。

## デモの仕様

データは各ブラウザーのlocalStorageに保存します。別端末との共有や本人認証はありません。
30分予約はブラウザーの時計で判定し、表示更新時・再表示時・操作時に期限を確認します。
現地の交換完了操作ではポイントを自動減算しません。スタッフが残高を手入力します。
顔写真は掲載同意を確認した住民だけ表示します。部屋番号を含む通知は本人同意時のみ出品者へ表示します。
サンプルの人物・商品は架空です。人物の画像とWebフォントなど、一部表示にインターネット接続を使用します。
このZIPにはブラウザー内の個人データやGit認証情報は含めていません。
