# express-endpoint-counter

Express.js用の軽量で効率的なミドルウェアで、APIエンドポイントの使用状況をカウント・監視します。TypeScriptを完全サポートしています。

## 特徴

- 📊 **エンドポイント使用状況の追跡**: メソッド別にグループ化してエンドポイントごとのリクエスト数をカウント
- ⏱️ **パフォーマンスメトリクス**: レスポンスタイム（平均、最小、最大）を追跡
- 🎯 **スマートパス正規化**: 動的ルートを自動的にグループ化（例：`/users/123` → `/users/:id`）
- 💾 **メモリ管理**: メモリリークを防ぐ設定可能なLRUキャッシュ
- 🔧 **高度な設定**: 様々なオプションで動作をカスタマイズ可能
- 📝 **TypeScriptサポート**: 完全な型定義を含む
- 🚀 **ゼロ依存**: Expressのみをピア依存関係として必要

## インストール

```bash
npm install express-endpoint-counter
```

または

```bash
yarn add express-endpoint-counter
```

```bash
pnpm add express-endpoint-counter
```

## クイックスタート

```typescript
import express from 'express';
import { createEndpointCounter } from 'express-endpoint-counter';

const app = express();
const counter = createEndpointCounter();

// ミドルウェアを適用
app.use(counter.middleware());

// ルートの定義
app.get('/users', (req, res) => {
  res.json({ users: [] });
});

app.get('/users/:id', (req, res) => {
  res.json({ user: { id: req.params.id } });
});

// 統計情報を取得
app.get('/stats', (req, res) => {
  res.json({
    summary: counter.getSummary(),
    top: counter.getTopEndpoints(5),
    slowest: counter.getSlowestEndpoints(5)
  });
});

app.listen(3000);
```

## APIリファレンス

### `createEndpointCounter(options?)`

新しいEndpointCounterインスタンスを作成します。

#### オプション

| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `includeQueryParams` | `boolean` | `false` | エンドポイント識別にクエリパラメータを含める |
| `groupByMethod` | `boolean` | `true` | HTTPメソッドでエンドポイントをグループ化 |
| `maxEndpoints` | `number` | `1000` | 追跡するエンドポイントの最大数 |
| `normalizePaths` | `boolean` | `true` | 動的ルートパラメータを正規化 |
| `enableLogging` | `boolean` | `true` | コンソールログを有効化 |
| `logger` | `(message: string) => void` | `console.log` | カスタムロガー関数 |
| `onUpdate` | `(endpoint: string, stats: EndpointStats) => void` | `() => {}` | 統計更新時のコールバック |

### メソッド

#### `middleware()`

Expressミドルウェア関数を返します。

```typescript
app.use(counter.middleware());
```

#### `getStats(endpoint?)`

特定のエンドポイントまたはすべてのエンドポイントの統計情報を取得します。

```typescript
// すべての統計を取得
const allStats = counter.getStats();

// 特定のエンドポイントの統計を取得
const userStats = counter.getStats('/users');
```

#### `getTopEndpoints(limit?)`

最もアクセスの多いエンドポイントを取得します。

```typescript
const top10 = counter.getTopEndpoints(10);
```

#### `getSlowestEndpoints(limit?)`

平均レスポンスタイムが最も長いエンドポイントを取得します。

```typescript
const slowest = counter.getSlowestEndpoints(5);
```

#### `getSummary()`

全体的なサマリー統計を取得します。

```typescript
const summary = counter.getSummary();
// {
//   totalEndpoints: 15,
//   totalRequests: 1523,
//   totalDuration: 45678,
//   averageDuration: 30,
//   topEndpoint: { endpoint: 'GET /users', stats: {...} },
//   slowestEndpoint: { endpoint: 'POST /upload', stats: {...} }
// }
```

#### `reset(endpoint?)`

特定のエンドポイントまたはすべてのエンドポイントの統計をリセットします。

```typescript
// すべてをリセット
counter.reset();
```

## その他使用方法

### モニタリングシステムとの統合

```typescript
const counter = createEndpointCounter({
  onUpdate: (endpoint, stats) => {
    // モニタリングシステムに送信
    metricsCollector.send({
      endpoint,
      count: stats.count,
      avgDuration: stats.averageDuration
    });
  }
});
```

### カスタムロギング

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  // ... winston設定
});

const counter = createEndpointCounter({
  logger: (message) => logger.info(message),
  enableLogging: true
});
```

### 統計ダッシュボードの作成

```typescript
app.get('/dashboard', (req, res) => {
  const stats = counter.getStats();
  const data = {
    summary: counter.getSummary(),
    endpoints: Array.from(stats.entries()).map(([endpoint, stats]) => ({
      endpoint,
      ...stats,
      lastAccessed: stats.lastAccessedAt.toISOString()
    })),
    topEndpoints: counter.getTopEndpoints(10),
    slowestEndpoints: counter.getSlowestEndpoints(10)
  };
  
  res.render('dashboard', { data });
});
```

## パフォーマンスについて

- ミドルウェアのオーバーヘッドは最小限（通常1ms未満）
- メモリ使用量は`maxEndpoints`オプションで制御
- LRU削除により無制限なメモリ増加を防止
- 必要がない場合はパス正規化を無効にしてパフォーマンスを向上可能

## TypeScript

このパッケージにはTypeScript定義が含まれています。型付けされた例：

```typescript
import express, { Request, Response } from 'express';
import { createEndpointCounter, EndpointStats } from 'express-endpoint-counter';

const app = express();
const counter = createEndpointCounter({
  onUpdate: (endpoint: string, stats: EndpointStats) => {
    console.log(`Updated ${endpoint}:`, stats);
  }
});

app.use(counter.middleware());
```

## 開発者向けガイド

### 開発環境のセットアップ

1. **リポジトリのクローン**
```bash
git clone https://github.com/yourusername/express-endpoint-counter.git
cd express-endpoint-counter
```

2. **依存関係のインストール**
```bash
npm install
```

3. **開発ツールの確認**
```bash
# TypeScriptコンパイラのバージョン確認
npx tsc --version

# Jestのバージョン確認
npx jest --version
```

### テスト実行の流れ

1. **単体テストの実行**
```bash
# すべてのテストを実行
npm test

# ウォッチモードでテストを実行（開発中に便利）
npm run test:watch

# カバレッジレポート付きでテストを実行
npm run test:coverage
```

2. **特定のテストファイルのみ実行**
```bash
# 特定のテストファイルを実行
npx jest src/index.test.ts

# 特定のテストスイートを実行
npx jest --testNamePattern="Path normalization"
```

3. **テストカバレッジの確認**
```bash
# カバレッジレポートを生成して表示
npm run test:coverage

# カバレッジレポートをブラウザで開く
open coverage/lcov-report/index.html  # macOS
# または
start coverage/lcov-report/index.html  # Windows
```

### ビルドとリント

1. **TypeScriptのビルド**
```bash
# プロダクションビルド
npm run build

# ビルド結果の確認
ls -la dist/
```

2. **リントの実行**
```bash
# ESLintでコード品質チェック
npm run lint

# リントエラーの自動修正
npx eslint src/**/*.ts --fix
```

### ローカルでの動作確認

1. **サンプルアプリケーションの実行**
```bash
# TypeScriptファイルを直接実行
npx ts-node examples/basic-usage.ts
```

2. **別のプロジェクトでローカルテスト**
```bash
# このパッケージをビルド
npm run build

# 別のディレクトリでテストプロジェクトを作成
cd /path/to/test-project
npm init -y
npm install express

# ローカルパッケージをリンク
npm link /path/to/express-endpoint-counter

# テストコードを作成して実行
```

### NPMへの公開手順

1. **公開前の準備**
```bash
# package.jsonの確認
# - name: パッケージ名が正しいか
# - version: バージョン番号が適切か
# - author: 作者情報が正しいか
# - repository: GitHubリポジトリURLが正しいか

# .npmignoreの確認（不要なファイルが除外されているか）
cat .npmignore

# ビルドとテストの実行
npm run build
npm test
```

2. **バージョン管理**
```bash
# パッチバージョンアップ (1.0.0 → 1.0.1)
npm version patch

# マイナーバージョンアップ (1.0.0 → 1.1.0)
npm version minor

# メジャーバージョンアップ (1.0.0 → 2.0.0)
npm version major

# プレリリースバージョン
npm version prerelease --preid=beta
# 1.0.0 → 1.0.1-beta.0
```

3. **NPMへのログイン**
```bash
# NPMアカウントでログイン
npm login
# Username: your-username
# Password: ********
# Email: your-email@example.com
```

4. **ドライラン（実際には公開しない）**
```bash
# 公開される内容を確認
npm pack --dry-run

# パッケージサイズの確認
npm pack
ls -lh *.tgz
```

5. **公開**
```bash
# 正式版として公開
npm publish

# ベータ版として公開
npm publish --tag beta

# スコープ付きパッケージの場合
npm publish --access public
```

6. **公開後の確認**
```bash
# NPMで確認
npm view express-endpoint-counter

# パッケージページを開く
open https://www.npmjs.com/package/express-endpoint-counter
```

### 継続的な開発

1. **新機能の追加**
```bash
# 新しいブランチを作成
git checkout -b feature/new-feature

# 開発とテスト
# ... コーディング ...
npm test

# プルリクエストの作成
git push origin feature/new-feature
```

2. **バグ修正**
```bash
# Issue番号付きのブランチを作成
git checkout -b fix/issue-123

# 修正とテスト
# ... 修正 ...
npm test

# コミットメッセージにIssue番号を含める
git commit -m "Fix memory leak in endpoint tracking (#123)"
```

3. **リリースプロセス**

このプロジェクトでは、GitHub Actionsを使用した自動化されたリリースプロセスを採用しています。

**リリース手順：**

以下は緊急時やトラブルシューティング用の手動手順です：

```bash
# mainブランチに切り替え
git checkout main
git pull origin main

# バージョンアップとタグ付け
npm version patch

# GitHubにプッシュ
git push origin main --tags

# NPMに公開
npm publish
```

**リリースワークフローの詳細：**

- `release.yml`: 手動でバージョンタグを作成
- `publish.yml`: タグがプッシュされた際に自動でNPM公開とGitHub Release作成

**必要なシークレット設定：**

GitHubリポジトリの Settings > Secrets and variables > Actions で以下を設定：
- `NPM_TOKEN`: NPMへの公開に必要なトークン

### トラブルシューティング

- **ビルドエラーが発生する場合**
  ```bash
  # node_modulesとdistを削除して再インストール
  rm -rf node_modules dist
  npm install
  npm run build
  ```

- **テストが失敗する場合**
  ```bash
  # Jestのキャッシュをクリア
  npx jest --clearCache
  ```

- **NPM公開エラー**
  ```bash
  # 認証の再実行
  npm logout
  npm login
  
  # レジストリの確認
  npm config get registry
  # https://registry.npmjs.org/ であることを確認
  ```

## コントリビューション

コントリビューションは歓迎します！以下のガイドラインに従ってください：

1. Issueを作成して問題や提案を議論
2. フォークしてfeatureブランチを作成
3. テストを含むコードを書く
4. すべてのテストが通ることを確認
5. Pull Requestを作成

## ライセンス

MIT

## 作者

Pianoopera

## リンク

- [GitHubリポジトリ](https://github.com/Pianoopera/express-endpoint-counter)
- [NPMパッケージ](https://www.npmjs.com/package/express-endpoint-counter)