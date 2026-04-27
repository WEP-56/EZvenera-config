<p align="center">
  <img src="assets/ico.png" alt="Logo" width="180" />
</p>

# EZVenera-config
## Plugin Status

<!-- plugin-status:start -->
Last updated: 2026-04-27T08:39:53Z UTC

Summary: 24 reachable, 5 limited, 0 offline, 0 error, 3 self-hosted, 0 unconfigured.

Live dashboard: https://wep-56.github.io/EZvenera-config/

| Plugin | Version | Status | HTTP | Probe | Note |
| --- | --- | --- | --- | --- | --- |
| baozi | 1.1.6 | reachable | 200 | [cn.bzmgcn.com](https://cn.bzmgcn.com/) | Uses the default public domain from plugin settings. |
| ccc | 1.0.1 | reachable | 200 | [api.creative-comic.tw](https://api.creative-comic.tw/) | - |
| comick | 1.2.0 | reachable | 200 | [comick.art](https://comick.art/) | - |
| copy_manga | 1.4.2 | reachable | 200 | [www.2026copy.com](https://www.2026copy.com/) | - |
| ehentai | 1.1.8 | reachable | 200 | [e-hentai.org/news.php](https://e-hentai.org/news.php) | Forum and main site are checked as a lightweight availability proxy. |
| goda | 1.0.0 | reachable | 200 | [godamh.com](https://godamh.com/) | Uses the default public site and API hosts from plugin settings. |
| hcomic | 1.0.0 | reachable | 200 | [h-comic.com](https://h-comic.com/) | - |
| hitomi | 1.1.2 | reachable | 200 | [hitomi.la](https://hitomi.la/) | Checks the public frontend and tag index host. |
| hot_manga | 1.0.0 | reachable | 200 | [www.manga2026.com/web/login/loginByAccount](https://www.manga2026.com/web/login/loginByAccount) | - |
| jcomic | 1.0.0 | reachable | 200 | [jcomic.net](https://jcomic.net/) | - |
| Komiic | 1.0.3 | reachable | 200 | [komiic.com](https://komiic.com/) | - |
| manga_dex | 1.1.0 | reachable | 200 | [mangadex.org](https://mangadex.org/) | - |
| mangaplus | 1.0.0 | reachable | 200 | [mangaplus.shueisha.co.jp](https://mangaplus.shueisha.co.jp/) | - |
| ManHuaGui | 1.2.1 | reachable | 200 | [www.manhuagui.com](https://www.manhuagui.com/) | - |
| manhuaren | 1.0.0 | reachable | 200 | [www.manhuaren.com](https://www.manhuaren.com/) | - |
| manwaba | 1.0.2 | reachable | 200 | [www.mhtmh.org](https://www.mhtmh.org/) | - |
| mh1234 | 1.0.0 | reachable | 200 | [gmh1234.wszwhg.net](https://gmh1234.wszwhg.net/) | - |
| mh18 | 1.0.0 | reachable | 200 | [18mh.org](https://18mh.org/) | - |
| mxs | 1.0.0 | reachable | 200 | [www.mxshm.top](https://www.mxshm.top/) | - |
| picacg | 1.0.5 | reachable | 200 | [manhuabika.com/pregister/](https://manhuabika.com/pregister/?) | - |
| shonen_jump_plus | 1.1.1 | reachable | 200 | [shonenjumpplus.com](https://shonenjumpplus.com/) | - |
| wnacg | 1.0.4 | reachable | 200 | [wn01.link](https://wn01.link/) | - |
| ykmh | 1.0.0 | reachable | 200 | [www.ykmh.net](https://www.ykmh.net/) | - |
| zaimanhua | 1.0.2 | reachable | 200 | [i.zaimanhua.com](https://i.zaimanhua.com/) | - |
| comic_walker | 1.0.0 | limited | 403 | [mobileapp.comic-walker.com](https://mobileapp.comic-walker.com/) | Endpoint responded but may be rate-limited or access-controlled. |
| happy | 1.0.0 | limited | 403 | [m.happymh.com](https://m.happymh.com/) | Endpoint responded but may be rate-limited or access-controlled. |
| ikmmh | 1.0.5 | limited | 403 | [www.ikmmh.com](https://www.ikmmh.com/) | Endpoint responded but may be rate-limited or access-controlled. |
| jm | 1.4.0 | limited | 403 | [www.cdntwice.org](https://www.cdntwice.org/) | JM domains are refreshed dynamically; probe uses the built-in fallback host and image CDN. Endpoint responded but may be rate-limited or access-controlled. |
| nhentai | 1.0.8 | limited | 403 | [nhentai.net](https://nhentai.net/) | Endpoint responded but may be rate-limited or access-controlled. |
| kavita | 1.0.0 | self_hosted | - | - | Self-hosted plugin. No public instance is checked by default; set a manual target in scripts/check-plugin-status.mjs if you want to monitor one. |
| komga | 1.0.0 | self_hosted | - | - | Self-hosted plugin. No public instance is checked by default; set a manual target in scripts/check-plugin-status.mjs if you want to monitor one. |
| lanraragi | 1.1.0 | self_hosted | - | - | Self-hosted plugin. No public instance is checked by default; set a manual target in scripts/check-plugin-status.mjs if you want to monitor one. |
<!-- plugin-status:end -->


这是 EZVenera 的主插件仓库，用来维护 EZVenera 使用的漫画源脚本。




## 仓库用途

这个仓库主要放三类内容：

1. 实际可安装的漫画源脚本
   - 例如 `jm.js`、`nhentai.js`、`picacg.js`
2. 插件模板与运行时声明
   - `_template_.js`
   - `_venera_.js`
3. 源索引
   - `index.json`

其中：

- `_template_.js` 用来作为新建源的起点（但不一定适用于EZVenera）
- `_venera_.js` 用来给编辑器提供类型提示和字段说明
- `index.json` 用来给 EZVenera 的“源列表”页面提供索引数据

## 当前兼容边界

EZVenera 当前重点保留这些插件能力：

- `account`
- `search`
- `category`
- `categoryComics`
- `comic.loadInfo`
- `comic.loadEp`
- `comic.onImageLoad`
- `comic.onThumbnailLoad`
- `settings`
- `comic.link`
- `comic.idMatch`
- `translation`

当前也已经支持：

- `categoryComics.optionLoader`
- `categoryComics.ranking.load`
- `categoryComics.ranking.loadNext`
- `categoryComics.ranking.loadWithNext`

有些源文件里仍然会保留原版 Venera 的其他字段，这是为了继续兼容原项目；EZVenera 对这些未接入能力通常会直接忽略，不会全部参与实际功能。

## 新建或更新一个源

在制作前，请务必阅读文档：https://wep-56.github.io/EZVenera/plugin-guide.html

建议顺序：

1. 把 `_template_.js` 和 `_venera_.js` 放在同一目录下使用
2. 复制 `_template_.js`，改成你的源文件名
3. 先把 EZVenera 当前保留的主链路做通
   - 搜索或分类入口
   - 详情页
   - 章节页
   - 图片链路
4. 新增或发布源时同步更新 `index.json`

如果是从原版 Venera 源移植过来，建议优先保证：

- `search`
- `category`
- `categoryComics`
- `comic.loadInfo`
- `comic.loadEp`

不要先花时间处理 EZVenera 当前未接入的：

- `explore`
- `favorites`
- 评论相关
- 评分相关
- `settings.callback`


## 使用ai制作插件
想要制作、修复漫画插件但无从下手？让claude、gpt来做吧！
你只需要向gpt（https://chatgpt.com/）或claude（https://claude.ai/chat）说：
```
请参考文档：https://wep-56.github.io/EZVenera/plugin-guide.html
基于：example.com（漫画源主站） 制作一个漫画源插件。
需要具备xxx功能
```
不到十分钟，它们就会给你一个还算可用的插件！在pc端通过本地安装，测试登陆、搜索、分类、详情、章节、下载、阅读这几个必要功能。把bug汇报（大多集中在阅读的图片解密相关），微调即可。

## 模板文件说明

### `_template_.js`

这是新建源最适合复制的模板，里面已经把常见字段、函数签名和注释都铺好了。

### `_venera_.js`

这是运行时声明文件，主要用于：

- 提示 `ComicSource`、`Comic`、`ComicDetails`、`ImageLoadingConfig` 等结构
- 给编辑器提供 JSDoc 类型补全
- 说明常见字段的预期格式

写源时建议在文件开头保留：

```js
/** @type {import('./_venera_.js')} */
```

## `index.json`

`index.json` 是源索引文件。EZVenera 应用会读取它来展示“漫画源列表”，因此：

- 新增源时要加到这里
- 下架或重命名源时也要同步更新这里
- 这里的链接应指向最终可下载的 `.js` 文件地址

## 相关仓库

应用主仓库：

- [WEP-56/EZVenera](https://github.com/WEP-56/EZVenera)

插件仓库：

- [WEP-56/EZvenera-config](https://github.com/WEP-56/EZvenera-config)

## 维护建议

如果你在这个仓库里维护源，推荐优先关注：

1. 能不能安装
2. 搜索 / 分类能不能正常进详情页
3. 阅读图片能不能稳定加载
4. 是否需要 `onImageLoad` / `onThumbnailLoad`
5. 是否需要 `modifyImage`

原因很简单：EZVenera 当前的核心体验就是“搜索 / 分类 -> 详情 -> 阅读 / 下载”，源脚本越贴近这条主链路，实际可用性越高。

## 贡献/修复图源

如果你想要添加图源、修复图源，直接提交pr并告诉我所有功能的可用性即可，无论是古法手敲还是LLM产出，这里没那么多规矩！但希望您可以持续维护自己添加的源