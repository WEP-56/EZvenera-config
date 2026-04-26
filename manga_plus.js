// ================================================================
// MANGA Plus by SHUEISHA  -  EZVenera 插件
// API: https://jumpg-webapi.tokyo-cdn.com/api
// 图片有 XOR 加密，通过 modifyImage 脚本处理
// ================================================================

class MangaPlus extends ComicSource {
    name = "MANGA Plus"
    key = "manga_plus"
    version = "1.0.0"
    minAppVersion = "1.2.2"
    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/manga_plus.js"

    // ── 内部常量 ──────────────────────────────────────────────
    get API() { return "https://jumpg-webapi.tokyo-cdn.com/api" }

    get HEADERS() {
        return {
            "user-agent": "Mozilla/5.0",
            "origin": "https://mangaplus.shueisha.co.jp",
            "referer": "https://mangaplus.shueisha.co.jp/"
        }
    }

    // ── 设置项 ────────────────────────────────────────────────
    settings = {
        language: {
            title: "语言 / Language",
            type: "select",
            options: [
                { value: "0", text: "English" },
                { value: "1", text: "日本語 (Japanese)" },
                { value: "2", text: "Español (Spanish)" },
                { value: "3", text: "Français (French)" },
                { value: "4", text: "Português (Portuguese)" },
                { value: "5", text: "Русский (Russian)" },
                { value: "6", text: "Bahasa Indonesia" },
                { value: "8", text: "Deutsch (German)" },
                { value: "10", text: "中文繁體 (Traditional Chinese)" },
                { value: "11", text: "中文简体 (Simplified Chinese)" },
                { value: "12", text: "Türkçe (Turkish)" },
                { value: "13", text: "한국어 (Korean)" }
            ],
            default: "0"
        }
    }

    get lang() {
        return parseInt(this.loadSetting("language") ?? "0")
    }

    // ── 搜索 ──────────────────────────────────────────────────
    // MangaPlus 没有分页搜索接口，拉全量本地过滤
    search = {
        load: async (keyword, options, page) => {
            if (page > 1) return { comics: [], maxPage: 1 }

            let res = await Network.get(
                `${this.API}/title_list/allV2?format=json`,
                this.HEADERS
            )
            if (res.status !== 200) throw `HTTP ${res.status}`

            let json = JSON.parse(res.body)
            let allGroups = json?.success?.allTitlesViewV2?.AllTitlesGroup ?? []

            let allTitles = []
            for (let group of allGroups) {
                for (let t of (group.titles ?? [])) {
                    allTitles.push(t)
                }
            }

            let kw = keyword.toLowerCase()
            let filtered = allTitles.filter(t => {
                let nameMatch = (t.name ?? "").toLowerCase().includes(kw)
                    || (t.author ?? "").toLowerCase().includes(kw)
                let langMatch = t.language === this.lang || t.language === undefined
                return nameMatch && langMatch
            })

            return {
                comics: filtered.map(t => this._titleToComic(t)),
                maxPage: 1
            }
        }
    }

    // ── 分类 ──────────────────────────────────────────────────
    category = {
        title: "分类",
        enableRankingPage: true,
        parts: [
            {
                name: "浏览",
                type: "fixed",
                categories: [
                    {
                        label: "最新更新",
                        target: { page: "category", attributes: { category: "updates", param: null } }
                    },
                    {
                        label: "热门连载",
                        target: { page: "category", attributes: { category: "serializing", param: null } }
                    },
                    {
                        label: "完结作品",
                        target: { page: "category", attributes: { category: "completed", param: null } }
                    },
                    {
                        label: "短篇",
                        target: { page: "category", attributes: { category: "oneshots", param: null } }
                    }
                ]
            }
        ]
    }

    categoryComics = {
        ranking: {
            options: [
                "hottest-热门榜",
                "trending-趋势榜",
                "completed-完结榜"
            ],
            load: async (option, page) => {
                const rankMap = { "hottest": 0, "trending": 1, "completed": 2 }
                let rankType = rankMap[option] ?? 0
                let res = await Network.get(
                    `${this.API}/title_list/ranking?format=json&rankingType=${rankType}`,
                    this.HEADERS
                )
                if (res.status !== 200) throw `HTTP ${res.status}`
                let json = JSON.parse(res.body)
                let titles = json?.success?.titleRankingView?.titles ?? []
                let filtered = titles.filter(t => t.language === this.lang || t.language === undefined)
                return {
                    comics: filtered.map(t => this._titleToComic(t)),
                    maxPage: 1
                }
            }
        },

        load: async (category, param, options, page) => {
            if (page > 1) return { comics: [], maxPage: 1 }

            let titles = []

            if (category === "updates") {
                let res = await Network.get(
                    `${this.API}/web/web_homeV4?format=json&lang=${this.lang}`,
                    this.HEADERS
                )
                if (res.status !== 200) throw `HTTP ${res.status}`
                let json = JSON.parse(res.body)
                let groups = json?.success?.webHomeViewV4?.groups ?? []
                for (let g of groups) {
                    for (let item of (g.titleGroups ?? [])) {
                        for (let t of (item.titles ?? [])) {
                            if (t.title) titles.push(t.title)
                        }
                    }
                }
            } else {
                let res = await Network.get(
                    `${this.API}/title_list/allV2?format=json`,
                    this.HEADERS
                )
                if (res.status !== 200) throw `HTTP ${res.status}`
                let json = JSON.parse(res.body)
                let allGroups = json?.success?.allTitlesViewV2?.AllTitlesGroup ?? []
                for (let group of allGroups) {
                    for (let t of (group.titles ?? [])) {
                        titles.push(t)
                    }
                }
                if (category === "oneshots") {
                    titles = titles.filter(t => t.isOneShot === true)
                }
            }

            titles = titles.filter(t => t.language === this.lang || t.language === undefined)

            return {
                comics: titles.slice(0, 200).map(t => this._titleToComic(t)),
                maxPage: 1
            }
        }
    }

    // ── 详情与章节 ────────────────────────────────────────────
    comic = {
        loadInfo: async (id) => {
            let res = await Network.get(
                `${this.API}/title_detailV3?format=json&title_id=${id}`,
                this.HEADERS
            )
            if (res.status !== 200) throw `HTTP ${res.status}`

            let json = JSON.parse(res.body)
            let detail = json?.success?.titleDetailView ?? {}
            let title = detail.title ?? {}

            let chapters = {}

            for (let ch of (detail.firstChapterList ?? [])) {
                if (ch.chapterId) {
                    chapters[ch.chapterId.toString()] = this._chapterName(ch)
                }
            }
            for (let ch of (detail.lastChapterList ?? [])) {
                if (ch.chapterId) {
                    chapters[ch.chapterId.toString()] = this._chapterName(ch)
                }
            }
            for (let group of (detail.chapterListGroup ?? [])) {
                for (let ch of (group.firstChapterList ?? [])) {
                    if (ch.chapterId && !chapters[ch.chapterId.toString()]) {
                        chapters[ch.chapterId.toString()] = this._chapterName(ch)
                    }
                }
                for (let ch of (group.lastChapterList ?? [])) {
                    if (ch.chapterId && !chapters[ch.chapterId.toString()]) {
                        chapters[ch.chapterId.toString()] = this._chapterName(ch)
                    }
                }
            }

            return new ComicDetails({
                title: title.name ?? id,
                subTitle: title.author ?? "",
                cover: title.portraitImageUrl ?? title.thumbnailUrl ?? "",
                description: detail.overview ?? detail.viewingPeriodDescription ?? "",
                tags: {
                    author: title.author ? [title.author] : [],
                    label: title.label?.name ? [title.label.name] : []
                },
                chapters: chapters,
                url: `https://mangaplus.shueisha.co.jp/titles/${id}`
            })
        },

        loadEp: async (comicId, epId) => {
            let res = await Network.get(
                `${this.API}/manga_viewer?format=json&chapter_id=${epId}&split=yes&img_quality=high`,
                this.HEADERS
            )
            if (res.status !== 200) throw `HTTP ${res.status}`

            let json = JSON.parse(res.body)
            let pages = json?.success?.mangaViewer?.pages ?? []

            // 将 url 和 encryptionKey 用 "|" 拼接传给 onImageLoad
            let images = []
            for (let p of pages) {
                let mp = p.mangaPage
                if (!mp || !mp.imageUrl) continue
                let key = mp.encryptionKey ?? ""
                images.push(mp.imageUrl + "|" + key)
            }

            return { images }
        },

        // 图片需要 XOR 解密
        onImageLoad: async (url, comicId, epId) => {
            let sepIdx = url.lastIndexOf("|")
            let realUrl = sepIdx > 0 ? url.substring(0, sepIdx) : url
            let encKey  = sepIdx > 0 ? url.substring(sepIdx + 1) : ""

            if (!encKey) {
                return {
                    url: realUrl,
                    headers: { "referer": "https://mangaplus.shueisha.co.jp/" }
                }
            }

            return {
                url: realUrl,
                headers: { "referer": "https://mangaplus.shueisha.co.jp/" },
                modifyImage: `
                    let modifyImage = (image) => {
                        let keyHex = "${encKey}";
                        let keyBytes = [];
                        for (let i = 0; i < keyHex.length; i += 2) {
                            keyBytes.push(parseInt(keyHex.substr(i, 2), 16));
                        }
                        if (keyBytes.length === 0) return image;
                        let keyLen = keyBytes.length;
                        let w = image.width;
                        let h = image.height;
                        let result = Image.empty(w, h);
                        for (let y = 0; y < h; y++) {
                            for (let x = 0; x < w; x++) {
                                let pixel = image.getPixel(x, y);
                                let idx = (y * w + x) * 4;
                                let r = ((pixel >> 16) & 0xFF) ^ keyBytes[idx % keyLen];
                                let g = ((pixel >> 8) & 0xFF) ^ keyBytes[(idx + 1) % keyLen];
                                let b = (pixel & 0xFF) ^ keyBytes[(idx + 2) % keyLen];
                                let a = (pixel >> 24) & 0xFF;
                                result.setPixel(x, y, (a << 24) | (r << 16) | (g << 8) | b);
                            }
                        }
                        return result;
                    }
                `
            }
        },

        onThumbnailLoad: (url) => {
            let realUrl = url.indexOf("|") > 0 ? url.substring(0, url.lastIndexOf("|")) : url
            return {
                url: realUrl,
                headers: { "referer": "https://mangaplus.shueisha.co.jp/" }
            }
        },

        idMatch: "^\\d+$",

        link: {
            domains: ["mangaplus.shueisha.co.jp"],
            linkToId: (url) => {
                let m = url.match(/titles\/(\d+)/)
                return m ? m[1] : null
            }
        }
    }

    // ── 工具方法 ──────────────────────────────────────────────
    _titleToComic(t) {
        return new Comic({
            id: t.titleId?.toString() ?? "",
            title: t.name ?? "",
            subTitle: t.author ?? "",
            cover: t.portraitImageUrl ?? t.thumbnailUrl ?? "",
            tags: t.label?.name ? [t.label.name] : []
        })
    }

    _chapterName(ch) {
        let name = ch.name ?? ""
        let sub  = ch.subTitle ?? ""
        return sub ? `${name} - ${sub}` : name
    }
}
