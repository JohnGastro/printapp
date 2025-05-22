# PrintApp - OCR＆Notion連携印刷アプリ

## 概要
PDFファイルをドラッグ＆ドロップすると、OCR処理で日本語テキストを抽出し、Notionデータベースに登録した後、印刷ダイアログを表示するElectronアプリケーションです。

## セットアップ方法

### 必要条件
- Node.js
- npm

### インストール
```bash
git clone https://github.com/JohnGastro/printapp.git
cd printapp
npm install
```

### 環境変数の設定
1. リポジトリのルートディレクトリに`.env`ファイルを作成
2. 以下の内容を追加（Notion APIの設定）
```
NOTION_TOKEN=your_notion_integration_token
NOTION_DATABASE_ID=your_notion_database_id
```

#### Notion APIの設定方法
1. Notionアカウントにログイン
2. https://www.notion.so/my-integrations にアクセス
3. 新しいインテグレーションを作成
4. 生成されたトークンを`.env`ファイルに設定
5. 対象のNotionデータベースを開く
6. URLからデータベースIDを取得（https://www.notion.so/{workspace}/{database_id}）
7. データベースの共有設定でインテグレーションにアクセス権を付与

### 実行方法
```bash
npm start
```

## 使用方法
1. アプリケーションを起動
2. PDFファイルをドラッグ＆ドロップ
3. OCR処理が実行され、テキストとタイトルが抽出される
4. 必要に応じて文書種別を入力
5. Notionへの保存と印刷ダイアログの表示が自動的に実行される
