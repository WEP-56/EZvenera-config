// ================================================================
// MANGA Plus by SHUEISHA - EZVenera plugin
// ================================================================

class MangaPlus extends ComicSource {
    name = "MANGA Plus"
    key = "manga_plus"
    version = "1.0.2"
    minAppVersion = "1.2.2"
    url = "https://raw.githubusercontent.com/YOUR_NAME/YOUR_REPO/main/manga_plus.js"

    get API() {
        return "https://jumpg-webapi.tokyo-cdn.com/api"
    }

    get HEADERS() {
        return {
            "user-agent": "Mozilla/5.0",
            "origin": "https://mangaplus.shueisha.co.jp",
            "referer": "https://mangaplus.shueisha.co.jp/"
        }
    }

    settings = {
        language: {
            title: "Language",
            type: "select",
            options: [
                { value: "0", text: "English" },
                { value: "1", text: "Japanese" },
                { value: "2", text: "Spanish" },
                { value: "3", text: "French" },
                { value: "4", text: "Portuguese" },
                { value: "5", text: "Russian" },
                { value: "6", text: "Indonesian" },
                { value: "8", text: "German" },
                { value: "10", text: "Traditional Chinese" },
                { value: "11", text: "Simplified Chinese" },
                { value: "12", text: "Turkish" },
                { value: "13", text: "Korean" }
            ],
            default: "0"
        }
    }

    get lang() {
        return parseInt(this.loadSetting("language") ?? "0")
    }

    search = {
        load: async (keyword, options, page) => {
            if (page > 1) {
                return { comics: [], maxPage: 1 }
            }

            const titles = await this._loadAllTitles()
            const kw = (keyword ?? "").trim().toLowerCase()
            const filtered = titles.filter((title) => {
                if (!this._matchLanguage(title)) {
                    return false
                }
                if (!kw) {
                    return true
                }
                return (title.name ?? "").toLowerCase().includes(kw) ||
                    (title.author ?? "").toLowerCase().includes(kw)
            })

            return {
                comics: filtered.map((title) => this._toComic(title)),
                maxPage: 1
            }
        }
    }

    category = {
        title: "Browse",
        enableRankingPage: true,
        parts: [
            {
                name: "Browse",
                type: "fixed",
                categories: [
                    { label: "Latest Updates", target: { page: "category", attributes: { category: "updates", param: null } } },
                    { label: "Serializing", target: { page: "category", attributes: { category: "serializing", param: null } } },
                    { label: "Completed", target: { page: "category", attributes: { category: "completed", param: null } } },
                    { label: "One-shots", target: { page: "category", attributes: { category: "oneshots", param: null } } }
                ]
            }
        ]
    }

    categoryComics = {
        ranking: {
            options: [
                "hottest-Hottest",
                "trending-Trending",
                "completed-Completed"
            ],
            load: async (option, page) => {
                const rankMap = {
                    hottest: 0,
                    trending: 1,
                    completed: 2
                }
                const res = await Network.get(
                    `${this.API}/title_list/ranking?format=json&rankingType=${rankMap[option] ?? 0}`,
                    this.HEADERS
                )
                if (res.status !== 200) {
                    throw `HTTP ${res.status}`
                }

                const json = JSON.parse(res.body)
                const titles = (json?.success?.titleRankingView?.titles ?? [])
                    .filter((title) => this._matchLanguage(title))

                return {
                    comics: titles.map((title) => this._toComic(title)),
                    maxPage: 1
                }
            }
        },

        load: async (category, param, options, page) => {
            if (page > 1) {
                return { comics: [], maxPage: 1 }
            }

            let titles = []
            if (category === "updates") {
                const res = await Network.get(
                    `${this.API}/web/web_homeV4?format=json&lang=${this.lang}`,
                    this.HEADERS
                )
                if (res.status !== 200) {
                    throw `HTTP ${res.status}`
                }

                const json = JSON.parse(res.body)
                for (const group of (json?.success?.webHomeViewV4?.groups ?? [])) {
                    for (const titleGroup of (group.titleGroups ?? [])) {
                        for (const item of (titleGroup.titles ?? [])) {
                            if (item.title) {
                                titles.push(item.title)
                            }
                        }
                    }
                }
            } else {
                titles = await this._loadAllTitles()
                if (category === "oneshots") {
                    titles = titles.filter((title) => title.isOneShot === true)
                }
            }

            titles = titles.filter((title) => this._matchLanguage(title))
            return {
                comics: titles.slice(0, 200).map((title) => this._toComic(title)),
                maxPage: 1
            }
        }
    }

    comic = {
        loadInfo: async (id) => {
            const res = await Network.get(
                `${this.API}/title_detailV3?format=json&title_id=${id}`,
                this.HEADERS
            )
            if (res.status !== 200) {
                throw `HTTP ${res.status}`
            }

            const json = JSON.parse(res.body)
            const detail = json?.success?.titleDetailView ?? {}
            const title = detail.title ?? {}
            const chapters = {}

            const addChapters = (list) => {
                for (const chapter of (list ?? [])) {
                    if (chapter.chapterId) {
                        chapters[chapter.chapterId.toString()] = this._chapterName(chapter)
                    }
                }
            }

            addChapters(detail.firstChapterList)
            addChapters(detail.lastChapterList)
            for (const group of (detail.chapterListGroup ?? [])) {
                addChapters(group.firstChapterList)
                addChapters(group.lastChapterList)
            }

            return new ComicDetails({
                title: title.name ?? id,
                subTitle: title.author ?? "",
                cover: title.portraitImageUrl ?? title.thumbnailUrl ?? "",
                description: detail.overview ?? "",
                tags: {
                    author: title.author ? [title.author] : [],
                    label: title.label?.name ? [title.label.name] : []
                },
                chapters,
                url: `https://mangaplus.shueisha.co.jp/titles/${id}`
            })
        },

        loadEp: async (comicId, epId) => {
            const res = await Network.get(
                `${this.API}/manga_viewer?format=json&chapter_id=${epId}&split=yes&img_quality=high`,
                this.HEADERS
            )
            if (res.status !== 200) {
                throw `HTTP ${res.status}`
            }

            const json = JSON.parse(res.body)
            const pages = json?.success?.mangaViewer?.pages ?? []
            const keyMap = {}
            const images = []

            for (const page of pages) {
                const mangaPage = page.mangaPage
                if (!mangaPage?.imageUrl) {
                    continue
                }

                images.push(mangaPage.imageUrl)
                if (mangaPage.encryptionKey) {
                    keyMap[mangaPage.imageUrl] = mangaPage.encryptionKey
                }
            }

            this.saveData(`keys_${epId}`, JSON.stringify(keyMap))
            return { images }
        },

        onImageLoad: async (url, comicId, epId) => {
            let encKey = ""
            try {
                const raw = this.loadData(`keys_${epId}`)
                if (raw) {
                    encKey = JSON.parse(raw)[url] ?? ""
                }
            } catch (e) {}

            if (!encKey) {
                return {
                    url,
                    headers: this.HEADERS
                }
            }

            const keyBytes = []
            for (let i = 0; i < encKey.length; i += 2) {
                const value = parseInt(encKey.slice(i, i + 2), 16)
                if (!Number.isNaN(value)) {
                    keyBytes.push(value)
                }
            }

            if (keyBytes.length === 0) {
                return {
                    url,
                    headers: this.HEADERS
                }
            }

            return {
                url,
                headers: this.HEADERS,
                onResponse: function (buffer) {
                    const view = new Uint8Array(buffer)
                    for (let i = 0; i < view.length; i++) {
                        view[i] ^= keyBytes[i % keyBytes.length]
                    }
                    return buffer
                }
            }
        },

        onThumbnailLoad: (url) => ({
            url,
            headers: this.HEADERS
        }),

        idMatch: "^\\d+$",

        link: {
            domains: ["mangaplus.shueisha.co.jp"],
            linkToId: (url) => {
                const match = url.match(/titles\/(\d+)/)
                return match ? match[1] : null
            }
        }
    }

    async _loadAllTitles() {
        const res = await Network.get(
            `${this.API}/title_list/allV2?format=json`,
            this.HEADERS
        )
        if (res.status !== 200) {
            throw `HTTP ${res.status}`
        }

        const json = JSON.parse(res.body)
        const groups = json?.success?.allTitlesViewV2?.AllTitlesGroup ?? []
        const titles = []
        for (const group of groups) {
            for (const title of (group.titles ?? [])) {
                titles.push(title)
            }
        }
        return titles
    }

    _matchLanguage(title) {
        return title.language === this.lang || title.language === undefined
    }

    _toComic(title) {
        return new Comic({
            id: title.titleId?.toString() ?? "",
            title: title.name ?? "",
            subTitle: title.author ?? "",
            cover: title.portraitImageUrl ?? title.thumbnailUrl ?? "",
            tags: title.label?.name ? [title.label.name] : []
        })
    }

    _chapterName(chapter) {
        const name = chapter.name ?? ""
        const sub = chapter.subTitle ?? ""
        return sub ? `${name} - ${sub}` : name
    }
}
