# 鎌倉幕府・ときめきタイムスリップ！
## 源氏三代と恋の御恩と奉公

`index.html` をブラウザで開くと遊べます。インストール、ビルド、サーバーは不要です。会話欄をクリックまたはタップして読み進め、四つの返答から一つを選びます。

[ブラウザで遊ぶ](https://afrotty07.github.io/kamakura-romance-time-slip/2026minamoto/)

スマートフォンのカメラでも公開ページを開けます。

![ゲームの公開ページを開くQRコード](qr-code.png)

- 源頼朝・源頼家・源実朝の3ルート。各6話で、最終好感度に応じて3種類の結末へ分岐します。
- プレイ中の「セーブ」「ロード」で3つのスロットを利用できます。エンディング達成は自動記録します。
- 記録はブラウザの `localStorage` に保存します。同じブラウザ・同じURLから開いてください。`file:` での永続保存はブラウザの設定や実装に依存します。

## ファイル構成

- `index.html` — ゲーム画面
- `style.css` — 和紙調のレイアウト、端末対応、表情差分の演出
- `scenarios.js` — 全18話の台詞・72の返答・全9種のエンディング
- `game.js` — 進行、好感度計算、保存、達成ギャラリー
- `assets/` — 背景3枚と立ち絵12枚

GitHub Pagesで公開する場合は、このフォルダの中身を公開元に配置するか、既存の公開元にこのフォルダを含めて `/2026minamoto/` から開きます。

## 史実と創作

登場人物と時代背景は史実に着想を得ています。会話、恋愛、タイムスリップは創作です。

- [鎌倉市「鎌倉市の歴史」](https://www.city.kamakura.kanagawa.jp/rekibun-rekishi.html)
- [鎌倉市「広報かまくら」令和4年度9月号](https://www.city.kamakura.kanagawa.jp/kouhou/kamakura/22/t220901-6.html)
- [宮内庁「蹴鞠」](https://www.kunaicho.go.jp/learn/culture/kemari/index.html)
