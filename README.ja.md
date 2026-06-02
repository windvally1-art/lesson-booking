# レッスン予約アプリ

1対1レッスン予約システム — React + Vite フロントエンド / Node.js + Express バックエンド / Supabase

## 主な機能

- **先生**: レッスン可能スロットの登録/編集/削除、予約確定・レッスン完了処理、生徒ごとのレッスンチケット管理
- **生徒**: 日付ストリップカレンダーでスロット予約、25分/50分チケット選択、予約履歴およびチケット残数確認
- **多言語**: 한국어 / 日本語 切替対応 (i18next)
- **通知**: メールリマインダー（5分間隔ポーリング）、ブラウザプッシュ通知

## フォルダ構成

```
lesson-booking/
├── frontend/          # React + Vite + Tailwind CSS
│   └── src/
│       ├── api/           # axiosクライアント
│       ├── components/
│       │   ├── auth/
│       │   ├── common/    # Navbar, PrivateRoute, PushPermission, ReminderSettings
│       │   ├── teacher/   # SlotManager, BookingList, PackageManager
│       │   └── student/   # BookingCalendar, BookingHistory, PackageStatus
│       ├── context/       # AuthContext (Supabase Auth)
│       ├── hooks/         # useDateLocale
│       ├── i18n.js        # i18next設定
│       ├── lib/           # supabaseクライアント
│       ├── locales/       # ko.json, ja.json
│       └── pages/
├── backend/           # Node.js + Express
│   └── src/
│       ├── lib/           # supabaseクライアント (service role)
│       ├── middleware/    # auth, errorHandler
│       ├── routes/        # slots, bookings, packages, push
│       └── services/      # emailService, reminderService
└── supabase/
    ├── migrations/    # 001〜004 スキーママイグレーション
    └── functions/     # send-reminder (Edge Function)
```

## DBテーブル

| テーブル | 役割 |
|----------|------|
| `profiles` | auth.usersの拡張 — 名前、ロール(teacher/student) |
| `time_slots` | 先生の対応可能時間帯 — EXCLUDEで重複防止 |
| `bookings` | 予約 — pending/confirmed/cancelled、`second_slot_id`(50分連続予約)、`completed_at` |
| `lesson_packages` | レッスンチケット — 25分/50分、総数/完了数、生徒と先生の紐付け |
| `push_subscriptions` | ブラウザプッシュ購読情報 |
| `notifications` | 送信済みメールログ |

## セットアップ

### 1. Supabaseの設定

1. [supabase.com](https://supabase.com) でプロジェクトを作成
2. `Database > Extensions` で **btree_gist** を有効化
3. `SQL Editor` で `supabase/migrations/` 内のファイルを 001→004 の順に実行
4. `Project Settings > API` から URL、anon key、service_role key をコピー

### 2. 環境変数の設定

```bash
# フロントエンド
cp frontend/.env.example frontend/.env
# VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY を入力

# バックエンド
cp backend/.env.example backend/.env
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SMTP_* を入力
```

### 3. 依存関係のインストールと起動

```bash
# フロントエンド
cd frontend
npm install
npm run dev          # http://localhost:5173

# バックエンド（別ターミナル）
cd backend
npm install
npm run dev          # http://localhost:4000
```

### 4. （任意）Supabase Edge Functionのデプロイ

```bash
npm install -g supabase
supabase login
supabase functions deploy send-reminder --project-ref <your-project-ref>
# ダッシュボードで RESEND_API_KEY シークレットを追加後、Cronを設定: 0 9 * * *
```

## APIエンドポイント

### スロット

| Method | Path | ロール | 説明 |
|--------|------|--------|------|
| `GET` | `/api/slots` | 先生 | 自分のスロット一覧 |
| `GET` | `/api/slots/available` | 生徒 | 予約可能スロット |
| `GET` | `/api/slots/all` | 生徒 | 全スロット（他の生徒の予約含む、カレンダー用） |
| `POST` | `/api/slots` | 先生 | スロット追加 |
| `PUT` | `/api/slots/:id` | 先生 | スロット編集 |
| `DELETE` | `/api/slots/:id` | 先生 | スロット削除 |

### 予約

| Method | Path | ロール | 説明 |
|--------|------|--------|------|
| `GET` | `/api/bookings/me` | 共通 | 自分の予約一覧 |
| `POST` | `/api/bookings` | 生徒 | 予約作成（25分: 1スロット、50分: 連続2スロット） |
| `PATCH` | `/api/bookings/:id/confirm` | 先生 | 予約確定 |
| `PATCH` | `/api/bookings/:id/complete` | 先生 | レッスン完了処理 |
| `PATCH` | `/api/bookings/:id/cancel` | 共通 | 予約キャンセル（生徒: レッスン開始6時間前まで） |
| `PATCH` | `/api/bookings/:id/reminders` | 生徒 | リマインダー設定 |

### レッスンチケット

| Method | Path | ロール | 説明 |
|--------|------|--------|------|
| `GET` | `/api/packages` | 共通 | 自分のチケット一覧 |
| `GET` | `/api/packages/students` | 先生 | 担当生徒一覧 |
| `POST` | `/api/packages` | 先生 | チケット作成 |
| `PATCH` | `/api/packages/:id` | 先生 | チケット編集 |
| `DELETE` | `/api/packages/:id` | 先生 | チケット削除 |

### プッシュ通知

| Method | Path | 説明 |
|--------|------|------|
| `GET` | `/api/push/vapid-key` | VAPID公開鍵の取得 |
| `POST` | `/api/push/subscribe` | プッシュ購読登録 |
| `DELETE` | `/api/push/subscribe` | プッシュ購読解除 |
