class CopyManga extends ComicSource {

    name = "拷贝漫画"

    key = "copy_manga"

    version = "1.4.2"

    minAppVersion = "1.6.0"

    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/copy_manga.js"

    async getReqID() {
        if (this.copyRegion === "0") {
            return "";
        }
        const reqIdUrl = "https://marketing.aiacgn.com/api/v2/adopr/query3/?format=json&ident=200100001";
        let reqId = "";
        try {
            const response = await Network.get(reqIdUrl, this.webHeaders);

            if (response.status === 200) {
                const data = JSON.parse(response.body);
                reqId = data.results.request_id;
            }
        } catch (e) {
        }
        return reqId;
    }

    // static defaultCopyVersion = "3.0.6"

    // static defaultCopyPlatform = "2"

    static defaultCopyRegion = "0"

    static defaultImageQuality = "1500"

    static defaultApiUrl = 'www.2026copy.com'

    static searchApi = "/api/kb/web/searchb/comics"

    get webHeaders() {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        }
    }

    get webApiHeaders() {
        let token = this.loadData("token") || ""
        let cookieParts = []
        if (token) {
            cookieParts.push(`token=${token}`)
        }
        try {
            let cookies = Network.getCookies(this.apiUrl)
            for (let c of cookies) {
                if (c.name !== 'token' && c.value) {
                    cookieParts.push(`${c.name}=${c.value}`)
                }
            }
        } catch (e) {}
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "platform": "2",
            "Authorization": token ? `Token ${token}` : "",
            "Cookie": cookieParts.join('; '),
        }
    }

    get apiUrl() {
        let baseUrl = this.loadSetting('base_url');
        if (!baseUrl) {
            baseUrl = CopyManga.defaultApiUrl;
        }
        return `https://${baseUrl}`
    }

    get copyRegion() {
        return this.loadSetting('region') || this.defaultCopyRegion
    }

    get imageQuality() {
        return this.loadSetting('image_quality') || this.defaultImageQuality
    }

    init() {
        this.author_path_word_dict = {}
        this.account.loginWithWebview.url = `${this.apiUrl}/web/login`
        this.refreshSearchApi()
        this.refreshAppApi()
    }

    _encodeBase64(str) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
        let result = ''
        let i = 0
        while (i < str.length) {
            const a = str.charCodeAt(i++)
            const b = i < str.length ? str.charCodeAt(i++) : 0
            const c = i < str.length ? str.charCodeAt(i++) : 0
            const bitmap = (a << 16) | (b << 8) | c
            result += chars.charAt((bitmap >> 18) & 63)
            result += chars.charAt((bitmap >> 12) & 63)
            result += (i > str.length + 1) ? '=' : chars.charAt((bitmap >> 6) & 63)
            result += (i > str.length) ? '=' : chars.charAt(bitmap & 63)
        }
        return result
    }

    /// account
    /// set this to null to desable account feature
    account = {
        login: async (account, pwd) => {
            Network.deleteCookies(this.apiUrl)

            let csrfToken = ""
            try {
                let pageRes = await Network.get(`${this.apiUrl}/web/login`, this.webHeaders)
                if (pageRes.status === 200) {
                    let cookies = Network.getCookies(this.apiUrl)
                    for (let cookie of cookies) {
                        if (cookie.name === 'csrftoken') {
                            csrfToken = cookie.value
                            break
                        }
                    }
                }
            } catch (e) {}

            let salt = 100000 + randomInt(0, 900000)
            let base64 = this._encodeBase64(`${pwd}-${salt}`)

            const loginPaths = ['/api/kb/web/login', '/api/v1/login']
            let lastError = null

            for (let path of loginPaths) {
                try {
                    let headers = {
                        "Accept": "application/json, text/plain, */*",
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "platform": "2",
                        "Referer": `${this.apiUrl}/web/login`,
                    }

                    if (csrfToken) {
                        headers["X-CSRFToken"] = csrfToken
                    }

                    let res = await Network.post(
                        `${this.apiUrl}${path}`,
                        headers,
                        `username=${encodeURIComponent(account)}&password=${encodeURIComponent(base64)}&salt=${salt}&platform=2&version=2025.12.10&source=freeSite`
                    );

                    if (res.status === 200) {
                        let data = JSON.parse(res.body)
                        if (data.code === 200) {
                            let token = data.results.token
                            this.saveData('token', token)

                            let domain = this.apiUrl.replace('https://', '').replace('http://', '').split('/')[0]
                            let cookiesToSet = [new Cookie({name: 'token', value: token, domain: domain})]
                            if (data.results.username) {
                                cookiesToSet.push(new Cookie({name: 'name', value: data.results.username, domain: domain}))
                            }
                            if (data.results.user_id) {
                                cookiesToSet.push(new Cookie({name: 'user_id', value: data.results.user_id, domain: domain}))
                            }
                            Network.setCookies(this.apiUrl, cookiesToSet)

                            return "ok"
                        } else {
                            throw data.message || '登录失败'
                        }
                    }
                } catch (e) {
                    lastError = e
                }
            }

            throw lastError || '登录失败'
        },
        loginWithWebview: {
            url: "https://www.2026copy.com/web/login",
            checkStatus: (url, title) => {
                let cookies = Network.getCookies(this.apiUrl)
                for (let cookie of cookies) {
                    if (cookie.name === 'token' && cookie.value) {
                        this.saveData('token', cookie.value)
                        return true
                    }
                }
                return false
            },
            onLoginSuccess: () => {
                let cookies = Network.getCookies(this.apiUrl)
                for (let cookie of cookies) {
                    if (cookie.name === 'token' && cookie.value) {
                        this.saveData('token', cookie.value)
                        break
                    }
                }
            },
        },
        logout: () => {
            this.deleteData('token')
            Network.deleteCookies(this.apiUrl)
        },
        registerWebsite: null
    }

    /// explore pages
    explore = [
        {
            title: "拷贝漫画",
            type: "singlePageWithMultiPart",
            load: async () => {
                let res = await Network.get(`${this.apiUrl}/`, this.webHeaders);
                if (res.status !== 200) {
                    throw `Invalid status code: ${res.status}`;
                }

                let html = res.body;
                let doc = new HtmlDocument(html);
                let result = {};

                function parseComicFromElement(item) {
                    let href = item.attributes['href'] || '';
                    if (!href.includes('/comic/')) return null;
                    
                    let pathWord = href.replace('/comic/', '').replace('/', '');
                    
                    let comicTitle = '';
                    let titleAttr = item.querySelector('[title]');
                    if (titleAttr && titleAttr.attributes) {
                        comicTitle = titleAttr.attributes['title'] || '';
                    }
                    if (!comicTitle) {
                        let titleEl2 = item.querySelector('.edit-txt');
                        comicTitle = titleEl2 && titleEl2.text ? titleEl2.text.trim() : '';
                    }
                    if (!comicTitle) {
                        let titleEl2 = item.querySelector('.twoLines');
                        comicTitle = titleEl2 && titleEl2.text ? titleEl2.text.trim() : '';
                    }
                    if (!comicTitle) {
                        comicTitle = item.text ? item.text.trim() : '';
                    }

                    let cover = '';
                    let img = item.querySelector('img');
                    if (img && img.attributes) {
                        cover = img.attributes['src'] || img.attributes['data-src'] || '';
                    }

                    let author = '';
                    let authorEl = item.querySelector('.exemptComicItem-txt-span');
                    if (!authorEl) authorEl = item.querySelector('.oneLines');
                    if (authorEl && authorEl.text) {
                        author = authorEl.text.trim();
                    }

                    let updateTime = '';
                    let updateEl = item.querySelector('.update span');
                    if (updateEl && updateEl.text) {
                        updateTime = updateEl.text.trim();
                    }

                    if (comicTitle && pathWord) {
                        return {
                            id: pathWord,
                            title: comicTitle,
                            subTitle: author,
                            cover: cover,
                            tags: [],
                            description: updateTime
                        };
                    }
                    return null;
                }

                function extractComics(selector, limit) {
                    let items = doc.querySelectorAll(selector);
                    let comics = [];
                    let seen = new Set();
                    for (let i = 0; i < items.length && comics.length < limit; i++) {
                        let comic = parseComicFromElement(items[i]);
                        if (comic && !seen.has(comic.id)) {
                            seen.add(comic.id);
                            comics.push(comic);
                        }
                    }
                    return comics;
                }

                let recommend = extractComics('.comicRank-box a[href*="/comic/"]', 20);
                if (recommend.length > 0) {
                    result["推荐"] = recommend;
                }

                let rows = doc.querySelectorAll('.content-box .row');
                if (rows.length > 0) {
                    let hotUpdate = [];
                    let seenHot = new Set();
                    let links = rows[0].querySelectorAll('a[href*="/comic/"]');
                    for (let i = 0; i < links.length && hotUpdate.length < 20; i++) {
                        let comic = parseComicFromElement(links[i]);
                        if (comic && !seenHot.has(comic.id)) {
                            seenHot.add(comic.id);
                            hotUpdate.push(comic);
                        }
                    }
                    if (hotUpdate.length > 0) {
                        result["热门更新"] = hotUpdate;
                    }
                }

                if (rows.length > 1) {
                    let newComics = [];
                    let seenNew = new Set();
                    let links = rows[1].querySelectorAll('a[href*="/comic/"]');
                    for (let i = 0; i < links.length && newComics.length < 20; i++) {
                        let comic = parseComicFromElement(links[i]);
                        if (comic && !seenNew.has(comic.id)) {
                            seenNew.add(comic.id);
                            newComics.push(comic);
                        }
                    }
                    if (newComics.length > 0) {
                        result["全新上架"] = newComics;
                    }
                }

                let allLinks = doc.querySelectorAll('a[href*="/comic/"]');
                let allComics = [];
                let seenAll = new Set();
                for (let i = 0; i < allLinks.length; i++) {
                    let comic = parseComicFromElement(allLinks[i]);
                    if (comic && !seenAll.has(comic.id)) {
                        seenAll.add(comic.id);
                        allComics.push(comic);
                    }
                }

                if (allComics.length > 0) {
                    let first20 = allComics.slice(0, 20);
                    let hasRecommend = result["推荐"] && result["推荐"].length > 0;
                    let hasHot = result["热门更新"] && result["热门更新"].length > 0;
                    
                    if (!hasRecommend && !hasHot) {
                        result["首页推荐"] = first20;
                    } else {
                        let existingIds = new Set();
                        if (hasRecommend) result["推荐"].forEach(c => existingIds.add(c.id));
                        if (hasHot) result["热门更新"].forEach(c => existingIds.add(c.id));
                        
                        let newComics = allComics.filter(c => !existingIds.has(c.id)).slice(0, 20);
                        if (newComics.length > 0) {
                            result["更多推荐"] = newComics;
                        }
                    }
                }

                return result;
            }
        }
    ]

    static category_param_dict = {
        "全部": "",
        "愛情": "aiqing",
        "歡樂向": "huanlexiang",
        "冒險": "maoxian",
        "奇幻": "qihuan",
        "百合": "baihe",
        "校园": "xiaoyuan",
        "科幻": "kehuan",
        "東方": "dongfang",
        "耽美": "danmei",
        "生活": "shenghuo",
        "格鬥": "gedou",
        "轻小说": "qingxiaoshuo",
        "悬疑": "xuanyi",
        "其他": "qita",
        "神鬼": "shengui",
        "职场": "zhichang",
        "TL": "teenslove",
        "萌系": "mengxi",
        "治愈": "zhiyu",
        "長條": "changtiao",
        "四格": "sige",
        "节操": "jiecao",
        "舰娘": "jianniang",
        "竞技": "jingji",
        "搞笑": "gaoxiao",
        "伪娘": "weiniang",
        "热血": "rexue",
        "励志": "lizhi",
        "性转换": "xingzhuanhuan",
        "彩色": "COLOR",
        "後宮": "hougong",
        "美食": "meishi",
        "侦探": "zhentan",
        "AA": "aa",
        "音乐舞蹈": "yinyuewudao",
        "魔幻": "mohuan",
        "战争": "zhanzheng",
        "历史": "lishi",
        "异世界": "yishijie",
        "惊悚": "jingsong",
        "机战": "jizhan",
        "都市": "dushi",
        "穿越": "chuanyue",
        "恐怖": "kongbu",
        "C100": "comiket100",
        "重生": "chongsheng",
        "C99": "comiket99",
        "C101": "comiket101",
        "C97": "comiket97",
        "C96": "comiket96",
        "生存": "shengcun",
        "宅系": "zhaixi",
        "武侠": "wuxia",
        "C98": "C98",
        "C95": "comiket95",
        "FATE": "fate",
        "转生": "zhuansheng",
        "無修正": "Uncensored",
        "仙侠": "xianxia",
        "LoveLive": "loveLive"
    }

    category = {
        title: "拷贝漫画",
        parts: [
            {
                name: "拷贝漫画",
                type: "fixed",
                categories: ["排行"],
                categoryParams: ["ranking"],
                itemType: "category"
            },
            {
                name: "主题",
                type: "fixed",
                categories: Object.keys(CopyManga.category_param_dict),
                categoryParams: Object.values(CopyManga.category_param_dict),
                itemType: "category"
            }
        ]
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            if (category.startsWith("author:")) {
                let authorName = category.substring("author:".length);
                let pathWord = this.author_path_word_dict[authorName] || null;

                if (!pathWord) {
                    try {
                        let searchHtmlRes = await Network.get(
                            `${this.apiUrl}/search?q=${encodeURIComponent(authorName)}`,
                            this.webHeaders
                        );
                        if (searchHtmlRes.status === 200) {
                            let searchDoc = new HtmlDocument(searchHtmlRes.body);
                            let authorLinks = searchDoc.querySelectorAll('a[href*="/author/"]');
                            for (let i = 0; i < authorLinks.length; i++) {
                                let link = authorLinks[i];
                                let href = link.attributes['href'] || '';
                                let match = href.match(/\/author\/([^\/]+)/);
                                if (match && match[1]) {
                                    let name = link.text ? link.text.trim() : '';
                                    if (name) {
                                        this.author_path_word_dict[name] = match[1];
                                    }
                                    if (!pathWord && name === authorName) {
                                        pathWord = match[1];
                                    }
                                    if (!pathWord) {
                                        pathWord = match[1];
                                    }
                                }
                            }
                        }
                    } catch (e) {
                    }
                }

                if (!pathWord) {
                    throw `无法找到作者: ${authorName}`;
                }

                this.author_path_word_dict[authorName] = pathWord;
                let authorUrl = `${this.apiUrl}/author/${encodeURIComponent(pathWord)}/comics?page=${page}`;
                let res = await Network.get(authorUrl, this.webHeaders);
                if (res.status !== 200) {
                    throw `Invalid status code: ${res.status}`;
                }

                let html = res.body;
                let doc = new HtmlDocument(html);
                let comics = [];

                let listBox = doc.querySelector('.exemptComicList .exemptComic-box');
                if (listBox && listBox.attributes && listBox.attributes['list']) {
                    try {
                        let rawList = listBox.attributes['list'];
                        let decoded;
                        try {
                            decoded = JSON.parse(rawList);
                        } catch (jsonErr) {
                            decoded = new Function('return ' + rawList)();
                        }
                        if (Array.isArray(decoded)) {
                            for (let item of decoded) {
                                let pw = item.path_word || '';
                                let title = item.name || '';
                                if (pw && title) {
                                    let authors = item.author || [];
                                    let authorNames = authors.map(a => a.name).filter(n => n);
                                    let authorName2 = authorNames.length > 0 ? authorNames.join(', ') : '';
                                    let cover = item.cover || '';
                                    let updateDate = item.datetime_updated || item.update_time || item.last_update_time || '';
                                    comics.push({
                                        id: pw,
                                        title: title,
                                        subTitle: authorName2,
                                        cover: cover,
                                        tags: [],
                                        description: updateDate
                                    });
                                }
                            }
                        }
                    } catch (e) {
                    }
                }

                if (comics.length === 0) {
                    let items = doc.querySelectorAll('.exemptComic-box a[href*="/comic/"]');
                    if (items.length === 0) {
                        items = doc.querySelectorAll('.correlationList a[href*="/comic/"]');
                    }
                    for (let i = 0; i < items.length; i++) {
                        let item = items[i];
                        let href = item.attributes['href'] || '';
                        let pw = href.replace('/comic/', '').replace('/', '');

                        let title = '';
                        let titleEl = item.querySelector('[title]');
                        if (titleEl && titleEl.attributes) {
                            title = titleEl.attributes['title'] || '';
                        }
                        if (!title) {
                            titleEl = item.querySelector('.edit-txt');
                            title = titleEl && titleEl.text ? titleEl.text.trim() : '';
                        }
                        if (!title) {
                            titleEl = item.querySelector('.twoLines');
                            title = titleEl && titleEl.text ? titleEl.text.trim() : '';
                        }
                        if (!title) {
                            title = item.text ? item.text.trim() : '';
                        }

                        let img = item.querySelector('img');
                        let cover = '';
                        if (img && img.attributes) {
                            cover = img.attributes['src'] || img.attributes['data-src'] || '';
                        }

                        let authorEl2 = item.querySelector('.exemptComicItem-txt-span');
                        if (!authorEl2) authorEl2 = item.querySelector('.oneLines');
                        let authorName2 = authorEl2 && authorEl2.text ? authorEl2.text.trim() : '';

                        let updateEl = item.querySelector('.update span');
                        let updateTime = updateEl && updateEl.text ? updateEl.text.trim() : '';

                        if (title && pw) {
                            comics.push({
                                id: pw,
                                title: title,
                                subTitle: authorName2,
                                cover: cover,
                                tags: [],
                                description: updateTime
                            });
                        }
                    }
                }

                let maxPage = 1;
                let totalFromList = 0;
                if (listBox && listBox.attributes && listBox.attributes['total']) {
                    totalFromList = parseInt(listBox.attributes['total']) || 0;
                }
                if (totalFromList > 0) {
                    maxPage = Math.ceil(totalFromList / 30);
                } else {
                    let pager = doc.querySelector('.page-all');
                    if (pager) {
                        let totalLabels = pager.querySelectorAll('.page-total');
                        if (totalLabels.length > 0) {
                            let lastLabel = totalLabels[totalLabels.length - 1];
                            maxPage = parseInt(lastLabel.text ? lastLabel.text.trim() : '1') || 1;
                        }
                    }
                }

                return {
                    comics: comics,
                    maxPage: maxPage
                };
            }

            let category_url;
            let isRanking = category === "排行" || param === "ranking";
            
            if (isRanking) {
                let typeParam = options[0] || "male";
                let tableParam = options[1] || "week";
                category_url = `${this.apiUrl}/rank?type=${typeParam}&table=${tableParam}`;
            } else {
                if (category !== undefined && category !== null) {
                    param = CopyManga.category_param_dict[category] || "";
                }
                let filterParam = options[0] || "";
                let orderingRaw = options[1] || "*datetime_updated";
                let orderingParam = orderingRaw.replace("*", "-");
                
                let baseUrl = `${this.apiUrl}/comics?theme=${param}`;
                if (filterParam && filterParam !== "*all") {
                    let value = filterParam.replace("*", "");
                    if (value === "finish") {
                        baseUrl += `&status=1`;
                    } else {
                        baseUrl += `&region=${value}`;
                    }
                }
                baseUrl += `&ordering=${orderingParam}&limit=30&offset=${(page - 1) * 30}`;
                category_url = baseUrl;
            }

            let res = await Network.get(category_url, this.webHeaders);
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`;
            }

            let html = res.body;
            let doc = new HtmlDocument(html);
            let comics = [];
            let totalFromList = 0;

            if (isRanking) {
                let items = doc.querySelectorAll('.ranking-all-box');
                for (let i = 0; i < items.length; i++) {
                    let item = items[i];
                    let anchor = item.querySelector('a[href*="/comic/"]');
                    if (!anchor) continue;
                    
                    let href = anchor.attributes['href'] || '';
                    let pathWord = href.replace('/comic/', '').replace('/', '');
                    
                    let titleEl = item.querySelector('.threeLines');
                    let title = '';
                    if (titleEl) {
                        title = titleEl.attributes['title'] || '';
                        if (!title && titleEl.text) title = titleEl.text.trim();
                    }
                    
                    let img = item.querySelector('img');
                    let cover = '';
                    if (img && img.attributes) {
                        cover = img.attributes['src'] || img.attributes['data-src'] || '';
                    }
                    
                    let authorEl = item.querySelector('.oneLines');
                    let author = authorEl && authorEl.text ? authorEl.text.replace(/\s+/g, ' ').trim() : '';
                    
                    let rankEl = item.querySelector('.ranking-all-icon');
                    let rank = rankEl && rankEl.text ? rankEl.text.trim() : '';
                    
                    let heatEl = item.querySelector('.update span');
                    let heat = heatEl && heatEl.text ? heatEl.text.trim() : '';
                    
                    let trend = '';
                    let trendEl = item.querySelector('.update-icon.up');
                    if (trendEl) trend = '▲';
                    else {
                        trendEl = item.querySelector('.update-icon.end');
                        if (trendEl) trend = '▽';
                    }

                    if (title && pathWord) {
                        comics.push({
                            id: pathWord,
                            title: title,
                            subTitle: author,
                            cover: cover,
                            tags: [],
                            description: `${rank} ${trend}\n${author}\n🔥${heat}`
                        });
                    }
                }
            } else {
                let listBox = doc.querySelector('.exemptComicList .exemptComic-box');
                if (listBox && listBox.attributes) {
                    if (listBox.attributes['total']) {
                        totalFromList = parseInt(listBox.attributes['total']) || 0;
                    }
                    if (listBox.attributes['list']) {
                        try {
                            let rawList = listBox.attributes['list'];
                            let decoded;
                            try {
                                decoded = JSON.parse(rawList);
                            } catch (jsonErr) {
                                decoded = new Function('return ' + rawList)();
                            }
                            if (Array.isArray(decoded)) {
                                for (let item of decoded) {
                                    let pathWord = item.path_word || '';
                                    let title = item.name || '';
                                    if (pathWord && title) {
                                        let authors = item.author || [];
                                        let authorNames = authors.map(a => a.name).filter(n => n);
                                        let author = authorNames.length > 0 ? authorNames.join(', ') : '';
                                        let cover = item.cover || '';
                                        let updateDate = item.datetime_updated || item.update_time || item.last_update_time || '';
                                        comics.push({
                                            id: pathWord,
                                            title: title,
                                            subTitle: author,
                                            cover: cover,
                                            tags: [],
                                            description: updateDate
                                        });
                                    }
                                }
                            }
                        } catch (e) {
                        }
                    }
                }
                
                if (comics.length === 0) {
                    let items = doc.querySelectorAll('.exemptComic-box a[href*="/comic/"]');
                    if (items.length === 0) {
                        items = doc.querySelectorAll('.correlationList a[href*="/comic/"]');
                    }
                    for (let i = 0; i < items.length; i++) {
                        let item = items[i];
                        let href = item.attributes['href'] || '';
                        let pathWord = href.replace('/comic/', '').replace('/', '');
                        
                        let title = '';
                        let titleEl = item.querySelector('[title]');
                        if (titleEl && titleEl.attributes) {
                            title = titleEl.attributes['title'] || '';
                        }
                        if (!title) {
                            titleEl = item.querySelector('.edit-txt');
                            title = titleEl && titleEl.text ? titleEl.text.trim() : '';
                        }
                        if (!title) {
                            titleEl = item.querySelector('.twoLines');
                            title = titleEl && titleEl.text ? titleEl.text.trim() : '';
                        }
                        if (!title) {
                            title = item.text ? item.text.trim() : '';
                        }
                        
                        let img = item.querySelector('img');
                        let cover = '';
                        if (img && img.attributes) {
                            cover = img.attributes['src'] || img.attributes['data-src'] || '';
                        }
                        
                        let authorEl = item.querySelector('.exemptComicItem-txt-span');
                        if (!authorEl) authorEl = item.querySelector('.oneLines');
                        let author = authorEl && authorEl.text ? authorEl.text.trim() : '';
                        
                        let updateEl = item.querySelector('.update span');
                        let updateTime = updateEl && updateEl.text ? updateEl.text.trim() : '';

                        if (title && pathWord) {
                            comics.push({
                                id: pathWord,
                                title: title,
                                subTitle: author,
                                cover: cover,
                                tags: [],
                                description: updateTime
                            });
                        }
                    }
                }
            }

            let maxPage = 1;
            if (totalFromList > 0) {
                maxPage = Math.ceil(totalFromList / 30);
            } else {
                let pager = doc.querySelector('.page-all');
                if (pager) {
                    let totalLabels = pager.querySelectorAll('.page-total');
                    if (totalLabels.length > 0) {
                        let lastLabel = totalLabels[totalLabels.length - 1];
                        let total = parseInt(lastLabel.text ? lastLabel.text.trim() : '1') || 1;
                        maxPage = total;
                    }
                }
            }

            return {
                comics: comics,
                maxPage: maxPage
            };
        },
        optionList: [
            {
                options: [
                    "*all-全部",
                    "0-日漫",
                    "1-韩漫",
                    "2-美漫",
                    "finish-已完结"
                ],
                notShowWhen: null,
                showWhen: Object.keys(CopyManga.category_param_dict)
            },
            {
                options: [
                    "*datetime_updated-时间倒序",
                    "datetime_updated-时间正序",
                    "*popular-热度倒序",
                    "popular-热度正序",
                ],
                notShowWhen: null,
                showWhen: Object.keys(CopyManga.category_param_dict)
            },
            {
                options: [
                    "male-男频",
                    "female-女频"
                ],
                notShowWhen: null,
                showWhen: ["排行"]
            },
            {
                options: [
                    "day-上升最快",
                    "week-最近7天",
                    "month-最近30天",
                    "total-總榜單"
                ],
                notShowWhen: null,
                showWhen: ["排行"]
            }
        ]
    }

    search = {
        load: async (keyword, options, page) => {
            let tagTheme = CopyManga.category_param_dict[keyword] || "";
            if (!tagTheme && keyword.startsWith("tag:")) {
                let tagName = keyword.substring("tag:".length).trim();
                tagTheme = CopyManga.category_param_dict[tagName] || "";
            }
            if (tagTheme) {
                let filterParam = options && options[0] ? options[0] : "";
                let orderingRaw = options && options[1] ? options[1] : "*datetime_updated";
                let orderingParam = orderingRaw.replace("*", "-");

                let baseUrl = `${this.apiUrl}/comics?theme=${tagTheme}`;
                if (filterParam && filterParam !== "*all") {
                    let value = filterParam.replace("*", "");
                    if (value === "finish") {
                        baseUrl += `&status=1`;
                    } else {
                        baseUrl += `&region=${value}`;
                    }
                }
                baseUrl += `&ordering=${orderingParam}&limit=30&offset=${(page - 1) * 30}`;

                let res = await Network.get(baseUrl, this.webHeaders);
                if (res.status !== 200) {
                    throw `Invalid status code: ${res.status}`;
                }

                let html = res.body;
                let doc = new HtmlDocument(html);
                let comics = [];
                let totalFromList = 0;

                let listBox = doc.querySelector('.exemptComicList .exemptComic-box');
                if (listBox && listBox.attributes) {
                    if (listBox.attributes['total']) {
                        totalFromList = parseInt(listBox.attributes['total']) || 0;
                    }
                    if (listBox.attributes['list']) {
                        try {
                            let rawList = listBox.attributes['list'];
                            let decoded;
                            try {
                                decoded = JSON.parse(rawList);
                            } catch (jsonErr) {
                                decoded = new Function('return ' + rawList)();
                            }
                            if (Array.isArray(decoded)) {
                                for (let item of decoded) {
                                    let pw = item.path_word || '';
                                    let title = item.name || '';
                                    if (pw && title) {
                                        let authors = item.author || [];
                                        let authorNames = authors.map(a => a.name).filter(n => n);
                                        comics.push({
                                            id: pw,
                                            title: title,
                                            subTitle: authorNames.length > 0 ? authorNames.join(', ') : '',
                                            cover: item.cover || '',
                                            tags: [],
                                            description: item.datetime_updated || item.update_time || item.last_update_time || ''
                                        });
                                    }
                                }
                            }
                        } catch (e) {
                        }
                    }
                }

                if (comics.length === 0) {
                    let items = doc.querySelectorAll('.exemptComic-box a[href*="/comic/"]');
                    if (items.length === 0) {
                        items = doc.querySelectorAll('.correlationList a[href*="/comic/"]');
                    }
                    for (let i = 0; i < items.length; i++) {
                        let item = items[i];
                        let href = item.attributes['href'] || '';
                        let pw = href.replace('/comic/', '').replace('/', '');

                        let title = '';
                        let titleEl = item.querySelector('[title]');
                        if (titleEl && titleEl.attributes) {
                            title = titleEl.attributes['title'] || '';
                        }
                        if (!title) {
                            titleEl = item.querySelector('.edit-txt');
                            title = titleEl && titleEl.text ? titleEl.text.trim() : '';
                        }
                        if (!title) {
                            titleEl = item.querySelector('.twoLines');
                            title = titleEl && titleEl.text ? titleEl.text.trim() : '';
                        }
                        if (!title) {
                            title = item.text ? item.text.trim() : '';
                        }

                        let img = item.querySelector('img');
                        let cover = '';
                        if (img && img.attributes) {
                            cover = img.attributes['src'] || img.attributes['data-src'] || '';
                        }

                        let authorEl = item.querySelector('.exemptComicItem-txt-span');
                        if (!authorEl) authorEl = item.querySelector('.oneLines');
                        let an = authorEl && authorEl.text ? authorEl.text.trim() : '';

                        let updateEl = item.querySelector('.update span');
                        let updateTime = updateEl && updateEl.text ? updateEl.text.trim() : '';

                        if (title && pw) {
                            comics.push({
                                id: pw,
                                title: title,
                                subTitle: an,
                                cover: cover,
                                tags: [],
                                description: updateTime
                            });
                        }
                    }
                }

                let maxPage = 1;
                if (totalFromList > 0) {
                    maxPage = Math.ceil(totalFromList / 30);
                } else {
                    let pager = doc.querySelector('.page-all');
                    if (pager) {
                        let totalLabels = pager.querySelectorAll('.page-total');
                        if (totalLabels.length > 0) {
                            let lastLabel = totalLabels[totalLabels.length - 1];
                            maxPage = parseInt(lastLabel.text ? lastLabel.text.trim() : '1') || 1;
                        }
                    }
                }

                return {
                    comics: comics,
                    maxPage: maxPage
                };
            }

            if (keyword.startsWith("tag:")) {
                let tagName = keyword.substring("tag:".length).trim();
                let themeParam = CopyManga.category_param_dict[tagName] || "";

                if (!themeParam) {
                    try {
                        let searchHtmlRes = await Network.get(
                            `${this.apiUrl}/search?q=${encodeURIComponent(tagName)}`,
                            this.webHeaders
                        );
                        if (searchHtmlRes.status === 200) {
                            let searchDoc = new HtmlDocument(searchHtmlRes.body);
                            let tagLinks = searchDoc.querySelectorAll('.comicParticulars-tag a, a[href*="/comics?theme="]');
                            for (let i = 0; i < tagLinks.length; i++) {
                                let link = tagLinks[i];
                                let href = link.attributes['href'] || '';
                                let themeMatch = href.match(/theme=([^&]+)/);
                                if (themeMatch && themeMatch[1]) {
                                    let name = link.text ? link.text.trim().replace(/^#/, '') : '';
                                    if (name) {
                                        CopyManga.category_param_dict[name] = themeMatch[1];
                                    }
                                    if (!themeParam && name === tagName) {
                                        themeParam = themeMatch[1];
                                    }
                                    if (!themeParam) {
                                        themeParam = themeMatch[1];
                                    }
                                }
                            }
                        }
                    } catch (e) {
                    }
                }

                if (themeParam) {
                    CopyManga.category_param_dict[tagName] = themeParam;
                    let filterParam = options && options[0] ? options[0] : "";
                    let orderingRaw = options && options[1] ? options[1] : "*datetime_updated";
                    let orderingParam = orderingRaw.replace("*", "-");

                    let baseUrl = `${this.apiUrl}/comics?theme=${themeParam}`;
                    if (filterParam && filterParam !== "*all") {
                        let value = filterParam.replace("*", "");
                        if (value === "finish") {
                            baseUrl += `&status=1`;
                        } else {
                            baseUrl += `&region=${value}`;
                        }
                    }
                    baseUrl += `&ordering=${orderingParam}&limit=30&offset=${(page - 1) * 30}`;

                    let res = await Network.get(baseUrl, this.webHeaders);
                    if (res.status !== 200) {
                        throw `Invalid status code: ${res.status}`;
                    }

                    let html = res.body;
                    let doc = new HtmlDocument(html);
                    let comics = [];
                    let totalFromList = 0;

                    let listBox = doc.querySelector('.exemptComicList .exemptComic-box');
                    if (listBox && listBox.attributes) {
                        if (listBox.attributes['total']) {
                            totalFromList = parseInt(listBox.attributes['total']) || 0;
                        }
                        if (listBox.attributes['list']) {
                            try {
                                let rawList = listBox.attributes['list'];
                                let decoded;
                                try {
                                    decoded = JSON.parse(rawList);
                                } catch (jsonErr) {
                                    decoded = new Function('return ' + rawList)();
                                }
                                if (Array.isArray(decoded)) {
                                    for (let item of decoded) {
                                        let pw = item.path_word || '';
                                        let title = item.name || '';
                                        if (pw && title) {
                                            let authors = item.author || [];
                                            let authorNames = authors.map(a => a.name).filter(n => n);
                                            comics.push({
                                                id: pw,
                                                title: title,
                                                subTitle: authorNames.length > 0 ? authorNames.join(', ') : '',
                                                cover: item.cover || '',
                                                tags: [],
                                                description: item.datetime_updated || item.update_time || item.last_update_time || ''
                                            });
                                        }
                                    }
                                }
                            } catch (e) {
                            }
                        }
                    }

                    if (comics.length === 0) {
                        let items = doc.querySelectorAll('.exemptComic-box a[href*="/comic/"]');
                        if (items.length === 0) {
                            items = doc.querySelectorAll('.correlationList a[href*="/comic/"]');
                        }
                        for (let i = 0; i < items.length; i++) {
                            let item = items[i];
                            let href = item.attributes['href'] || '';
                            let pw = href.replace('/comic/', '').replace('/', '');

                            let title = '';
                            let titleEl = item.querySelector('[title]');
                            if (titleEl && titleEl.attributes) {
                                title = titleEl.attributes['title'] || '';
                            }
                            if (!title) {
                                titleEl = item.querySelector('.edit-txt');
                                title = titleEl && titleEl.text ? titleEl.text.trim() : '';
                            }
                            if (!title) {
                                titleEl = item.querySelector('.twoLines');
                                title = titleEl && titleEl.text ? titleEl.text.trim() : '';
                            }
                            if (!title) {
                                title = item.text ? item.text.trim() : '';
                            }

                            let img = item.querySelector('img');
                            let cover = '';
                            if (img && img.attributes) {
                                cover = img.attributes['src'] || img.attributes['data-src'] || '';
                            }

                            let authorEl = item.querySelector('.exemptComicItem-txt-span');
                            if (!authorEl) authorEl = item.querySelector('.oneLines');
                            let an = authorEl && authorEl.text ? authorEl.text.trim() : '';

                            let updateEl = item.querySelector('.update span');
                            let updateTime = updateEl && updateEl.text ? updateEl.text.trim() : '';

                            if (title && pw) {
                                comics.push({
                                    id: pw,
                                    title: title,
                                    subTitle: an,
                                    cover: cover,
                                    tags: [],
                                    description: updateTime
                                });
                            }
                        }
                    }

                    let maxPage = 1;
                    if (totalFromList > 0) {
                        maxPage = Math.ceil(totalFromList / 30);
                    } else {
                        let pager = doc.querySelector('.page-all');
                        if (pager) {
                            let totalLabels = pager.querySelectorAll('.page-total');
                            if (totalLabels.length > 0) {
                                let lastLabel = totalLabels[totalLabels.length - 1];
                                maxPage = parseInt(lastLabel.text ? lastLabel.text.trim() : '1') || 1;
                            }
                        }
                    }

                    return {
                        comics: comics,
                        maxPage: maxPage
                    };
                }
            }

            let authorName = keyword;
            if (keyword.startsWith("作者:")) {
                authorName = keyword.substring("作者:".length).trim();
            }

            let pathWord = this.author_path_word_dict[authorName] || null;

            if (!pathWord) {
                try {
                    let searchHtmlRes = await Network.get(
                        `${this.apiUrl}/search?q=${encodeURIComponent(authorName)}`,
                        this.webHeaders
                    );
                    if (searchHtmlRes.status === 200) {
                        let searchDoc = new HtmlDocument(searchHtmlRes.body);
                        let authorLinks = searchDoc.querySelectorAll('a[href*="/author/"]');
                        for (let i = 0; i < authorLinks.length; i++) {
                            let link = authorLinks[i];
                            let href = link.attributes['href'] || '';
                            let match = href.match(/\/author\/([^\/]+)/);
                            if (match && match[1]) {
                                let name = link.text ? link.text.trim() : '';
                                if (name) {
                                    this.author_path_word_dict[name] = match[1];
                                }
                                if (!pathWord && name === authorName) {
                                    pathWord = match[1];
                                }
                                if (!pathWord) {
                                    pathWord = match[1];
                                }
                            }
                        }
                    }
                } catch (e) {
                }
            }

            if (pathWord) {
                this.author_path_word_dict[authorName] = pathWord;
                let authorUrl = `${this.apiUrl}/author/${encodeURIComponent(pathWord)}/comics?page=${page}`;
                let res = await Network.get(authorUrl, this.webHeaders);
                if (res.status !== 200) {
                    throw `Invalid status code: ${res.status}`;
                }

                let doc = new HtmlDocument(res.body);
                let comics = [];

                let listBox = doc.querySelector('.exemptComicList .exemptComic-box');
                if (listBox && listBox.attributes && listBox.attributes['list']) {
                    try {
                        let rawList = listBox.attributes['list'];
                        let decoded;
                        try {
                            decoded = JSON.parse(rawList);
                        } catch (jsonErr) {
                            decoded = new Function('return ' + rawList)();
                        }
                        if (Array.isArray(decoded)) {
                            for (let item of decoded) {
                                let pw = item.path_word || '';
                                let title = item.name || '';
                                if (pw && title) {
                                    let authors = item.author || [];
                                    let authorNames = authors.map(a => a.name).filter(n => n);
                                    comics.push({
                                        id: pw,
                                        title: title,
                                        subTitle: authorNames.length > 0 ? authorNames.join(', ') : '',
                                        cover: item.cover || '',
                                        tags: [],
                                        description: item.datetime_updated || item.update_time || item.last_update_time || ''
                                    });
                                }
                            }
                        }
                    } catch (e) {
                    }
                }

                if (comics.length === 0) {
                    let items = doc.querySelectorAll('.exemptComic-box a[href*="/comic/"]');
                    if (items.length === 0) {
                        items = doc.querySelectorAll('.correlationList a[href*="/comic/"]');
                    }
                    for (let i = 0; i < items.length; i++) {
                        let item = items[i];
                        let href = item.attributes['href'] || '';
                        let pw = href.replace('/comic/', '').replace('/', '');

                        let title = '';
                        let titleEl = item.querySelector('[title]');
                        if (titleEl && titleEl.attributes) {
                            title = titleEl.attributes['title'] || '';
                        }
                        if (!title) {
                            titleEl = item.querySelector('.edit-txt');
                            title = titleEl && titleEl.text ? titleEl.text.trim() : '';
                        }
                        if (!title) {
                            titleEl = item.querySelector('.twoLines');
                            title = titleEl && titleEl.text ? titleEl.text.trim() : '';
                        }
                        if (!title) {
                            title = item.text ? item.text.trim() : '';
                        }

                        let img = item.querySelector('img');
                        let cover = '';
                        if (img && img.attributes) {
                            cover = img.attributes['src'] || img.attributes['data-src'] || '';
                        }

                        let authorEl = item.querySelector('.exemptComicItem-txt-span');
                        if (!authorEl) authorEl = item.querySelector('.oneLines');
                        let an = authorEl && authorEl.text ? authorEl.text.trim() : '';

                        let updateEl = item.querySelector('.update span');
                        let updateTime = updateEl && updateEl.text ? updateEl.text.trim() : '';

                        if (title && pw) {
                            comics.push({
                                id: pw,
                                title: title,
                                subTitle: an,
                                cover: cover,
                                tags: [],
                                description: updateTime
                            });
                        }
                    }
                }

                let maxPage = 1;
                let totalFromList = 0;
                if (listBox && listBox.attributes && listBox.attributes['total']) {
                    totalFromList = parseInt(listBox.attributes['total']) || 0;
                }
                if (totalFromList > 0) {
                    maxPage = Math.ceil(totalFromList / 30);
                } else {
                    let pager = doc.querySelector('.page-all');
                    if (pager) {
                        let totalLabels = pager.querySelectorAll('.page-total');
                        if (totalLabels.length > 0) {
                            let lastLabel = totalLabels[totalLabels.length - 1];
                            maxPage = parseInt(lastLabel.text ? lastLabel.text.trim() : '1') || 1;
                        }
                    }
                }

                return {
                    comics: comics,
                    maxPage: maxPage
                };
            }

            let q_type = "";
            if (options && options[0]) {
                q_type = options[0];
            }
            keyword = encodeURIComponent(keyword)
            let search_url = this.loadSetting('search_api') === "webAPI"
                ? `${this.apiUrl}${CopyManga.searchApi}`
                : `${this.apiUrl}/api/v3/search/comic`
            let res = await Network.get(
                `${search_url}?limit=30&offset=${(page - 1) * 30}&q=${keyword}&q_type=${q_type}`,
                this.webApiHeaders
            )
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }

            let data = JSON.parse(res.body)

            function parseComic(comic) {
                if (comic["comic"] !== null && comic["comic"] !== undefined) {
                    comic = comic["comic"]
                }
                let tags = []
                if (comic["theme"] !== null && comic["theme"] !== undefined) {
                    tags = comic["theme"].map(t => t["name"])
                }
                let author = null

                if (Array.isArray(comic["author"]) && comic["author"].length > 0) {
                    author = comic["author"][0]["name"]
                    if (author && comic["author"][0]["path_word"]) {
                        this.author_path_word_dict[author] = comic["author"][0]["path_word"]
                    }
                }

                return {
                    id: comic["path_word"],
                    title: comic["name"],
                    subTitle: author,
                    cover: comic["cover"],
                    tags: tags,
                    description: comic["datetime_updated"]
                }
            }

            return {
                comics: data["results"]["list"].map(parseComic.bind(this)),
                maxPage: (data["results"]["total"] - (data["results"]["total"] % 21)) / 21 + 1
            }
        },
        optionList: [
            {
                type: "select",
                options: [
                    "-全部",
                    "name-名称",
                    "author-作者",
                    "local-汉化组"
                ],
                label: "搜索选项"
            }
        ]
    }

    favorites = {
        multiFolder: false,
        addOrDelFavorite: async (comicId, folderId, isAdding) => {
            let is_collect = isAdding ? 1 : 0
            let token = this.loadData("token");
            let comicData = await Network.get(
                `${this.apiUrl}/api/v3/comic2/${comicId}?in_mainland=true&platform=2`,
                this.webApiHeaders
            )
            if (comicData.status !== 200) {
                throw `Invalid status code: ${comicData.status}`
            }
            let comic_id = JSON.parse(comicData.body).results.comic.uuid
            let res = await Network.post(
                `${this.apiUrl}/api/v3/member/collect/comic`,
                {
                    ...this.webApiHeaders,
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
                },
                `comic_id=${comic_id}&is_collect=${is_collect}`
            )
            if (res.status === 401) {
                throw `Login expired`;
            }
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            return "ok"
        },
        loadComics: async (page, folder) => {
            let ordering = this.loadSetting('favorites_ordering') || '-datetime_updated';
            var res = await Network.get(
                `${this.apiUrl}/api/v3/member/collect/comics?limit=30&offset=${(page - 1) * 30}&free_type=1&ordering=${ordering}`,
                this.webApiHeaders
            )

            if (res.status === 401) {
                throw `Login expired`
            }

            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }

            let data = JSON.parse(res.body)

            function parseComic(comic) {
                if (comic["comic"] !== null && comic["comic"] !== undefined) {
                    comic = comic["comic"]
                }
                let tags = []
                if (comic["theme"] !== null && comic["theme"] !== undefined) {
                    tags = comic["theme"].map(t => t["name"])
                }
                let author = null

                if (Array.isArray(comic["author"]) && comic["author"].length > 0) {
                    author = comic["author"][0]["name"]
                    if (author && comic["author"][0]["path_word"]) {
                        this.author_path_word_dict[author] = comic["author"][0]["path_word"]
                    }
                }

                return {
                    id: comic["path_word"],
                    title: comic["name"],
                    subTitle: author,
                    cover: comic["cover"],
                    tags: tags,
                    description: comic["datetime_updated"]
                }
            }

            return {
                comics: data["results"]["list"].map(parseComic.bind(this)),
                maxPage: (data["results"]["total"] - (data["results"]["total"] % 21)) / 21 + 1
            }
        }
    }

    comic = {
        loadInfo: async (id) => {
            let res = await Network.get(`${this.apiUrl}/comic/${id}`, this.webHeaders);
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`;
            }

            let html = res.body;
            let doc = new HtmlDocument(html);

            let title = '';
            let titleEl = doc.querySelector('h6[title]');
            if (titleEl && titleEl.attributes) {
                title = titleEl.attributes['title'] || '';
            }
            if (!title) {
                let pageTitle = doc.querySelector('title');
                title = pageTitle && pageTitle.text ? pageTitle.text.trim().split('-')[0].trim() : '';
            }

            let cover = '';
            let coverImg = doc.querySelector('.comicParticulars-left-img img');
            if (coverImg && coverImg.attributes) {
                cover = coverImg.attributes['src'] || coverImg.attributes['data-src'] || '';
            }

            let authors = [];
            let authorEl = doc.querySelector('.comicParticulars-title-right');
            if (authorEl) {
                let authorLinks = authorEl.querySelectorAll('a');
                for (let i = 0; i < authorLinks.length; i++) {
                    let link = authorLinks[i];
                    let text = link.text ? link.text.trim() : '';
                    if (text && !authors.includes(text)) {
                        authors.push(text);
                    }
                    let href = link.attributes['href'] || '';
                    let authorMatch = href.match(/\/author\/([^\/]+)/);
                    if (authorMatch && authorMatch[1] && text) {
                        this.author_path_word_dict[text] = authorMatch[1];
                    }
                }
            }

            let tags = [];
            let tagEls = doc.querySelectorAll('.comicParticulars-tag a');
            for (let i = 0; i < tagEls.length; i++) {
                let tag = tagEls[i];
                let text = tag.text ? tag.text.trim().replace(/^#/, '') : '';
                if (text && !tags.includes(text)) {
                    tags.push(text);
                }
            }

            let description = '';
            let introEl = doc.querySelector('.intro');
            if (introEl) {
                description = introEl.text ? introEl.text.trim() : '';
            }

            let updateTime = '';
            let status = '';
            let infoItems = doc.querySelectorAll('.comicParticulars-title-right li');
            for (let i = 0; i < infoItems.length; i++) {
                let item = infoItems[i];
                let text = item.text ? item.text.replace(/\s+/g, ' ').trim() : '';
                if (text.includes('最後更新') || text.includes('最后更新')) {
                    updateTime = text.replace(/最後更新|最后更新/g, '').replace(/^\s*[:：]\s*/, '').trim();
                }
                if (text.includes('狀態') || text.includes('状态')) {
                    status = text.replace(/狀態|状态/g, '').replace(/^\s*[:：]\s*/, '').trim();
                }
            }

            let chapters = {};
            let hasGroups = false;
            
            let ccz = '';
            let cczPatterns = [
                /(?:var|let|const)\s+ccz\s*=\s*['"]([^'"]+)['"]/,
                /window\.ccz\s*=\s*['"]([^'"]+)['"]/,
                /ccz\s*=\s*['"]([^'"]+)['"]/
            ];
            for (let pattern of cczPatterns) {
                let match = html.match(pattern);
                if (match && match[1]) {
                    ccz = match[1];
                    break;
                }
            }
            
            let dntEl = doc.querySelector('#dnt');
            let dnt = dntEl && dntEl.attributes ? dntEl.attributes['value'] || '' : '';
            
            if (ccz && dnt) {
                try {
                    let chapterUrl = `${this.apiUrl}/comicdetail/${id}/chapters`;
                    
                    let chapterRes = await Network.get(
                        chapterUrl,
                        {
                            ...this.webHeaders,
                            'Accept': 'application/json, text/plain, */*',
                            'Referer': `${this.apiUrl}/comic/${id}`,
                            'dnts': dnt
                        }
                    );
                    
                    if (chapterRes.status === 200) {
                        let chapterData = JSON.parse(chapterRes.body);
                        
                        if (chapterData.code === 200 && chapterData.results) {
                            let encrypted = chapterData.results.trim();
                            
                            if (encrypted.length > 16) {
                                let ivStr = encrypted.substring(0, 16);
                                let cipherStr = encrypted.substring(16);
                                
                                let keyBytes = Convert.encodeUtf8(ccz);
                                let ivBytes = Convert.encodeUtf8(ivStr);
                                
                                let cipherBytes;
                                if (/^[0-9a-fA-F]+$/.test(cipherStr) && cipherStr.length % 2 === 0) {
                                    let hexBytes = new Uint8Array(cipherStr.length / 2);
                                    for (let i = 0; i < cipherStr.length; i += 2) {
                                        hexBytes[i / 2] = parseInt(cipherStr.substring(i, i + 2), 16);
                                    }
                                    cipherBytes = hexBytes.buffer;
                                } else {
                                    cipherBytes = Convert.decodeBase64(cipherStr);
                                }
                                
                                let plainBytes = Convert.decryptAesCbc(cipherBytes, keyBytes, ivBytes);
                                let plainText = Convert.decodeUtf8(plainBytes);
                                let parsed = JSON.parse(plainText);
                                
                                let groups = parsed.groups;
                                if (groups) {
                                    let groupKeys = Object.keys(groups);
                                    for (let gKey of groupKeys) {
                                        let group = groups[gKey];
                                        let groupName = group.name || gKey;
                                        if (group.chapters && group.chapters.length > 0) {
                                            hasGroups = true;
                                            let groupChapters = {};
                                            for (let chapter of group.chapters) {
                                                let chapterId = chapter.id || chapter.uuid;
                                                let chapterTitle = chapter.name || '';
                                                if (chapterId && chapterTitle) {
                                                    groupChapters[chapterId] = chapterTitle;
                                                }
                                            }
                                            chapters[groupName] = groupChapters;
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.log('Chapter decryption failed: ' + e);
                }
            }

            if (!hasGroups) {
                chapters = {};
                let chapterLinks = doc.querySelectorAll('a[href*="/chapter/"]');
                
                let seenChapters = new Set();
                for (let i = chapterLinks.length - 1; i >= 0; i--) {
                    let link = chapterLinks[i];
                    let href = link.attributes['href'] || '';
                    let chapterTitle = link.text ? link.text.trim() : '';
                    
                    if (href && chapterTitle && !seenChapters.has(href)) {
                        seenChapters.add(href);
                        let parts = href.split('/');
                        let chapterId = '';
                        for (let j = parts.length - 1; j >= 0; j--) {
                            if (parts[j] && parts[j] !== 'chapter') {
                                chapterId = parts[j];
                                break;
                            }
                        }
                        if (chapterId) {
                            chapters[chapterId] = chapterTitle;
                        }
                    }
                }
            }

            let comicId = '';
            let collectBtn = doc.querySelector('.comicParticulars-botton.collect');
            if (collectBtn && collectBtn.attributes) {
                let onclick = collectBtn.attributes['onclick'] || '';
                let match = onclick.match(/collect\s*\(\s*['"]([^'"]+)['"]/);
                if (match) {
                    comicId = match[1];
                }
            }

            let isFavorite = false;
            if (collectBtn) {
                let btnText = collectBtn.text || '';
                isFavorite = btnText.includes('已收藏');
            }

            return {
                title: title,
                cover: cover,
                description: description,
                tags: {
                    "作者": authors,
                    "更新": [updateTime],
                    "标签": tags,
                    "状态": [status],
                },
                chapters: chapters,
                isFavorite: isFavorite,
                subId: comicId
            }
        },
        loadEp: async (comicId, epId) => {
            let res = await Network.get(
                `${this.apiUrl}/comic/${comicId}/chapter/${epId}`,
                this.webHeaders
            );

            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`;
            }

            let html = res.body;
            let doc = new HtmlDocument(html);

            let images = [];
            
            let contentKey = '';
            let contentKeyPatterns = [
                /(?:var|let|const)\s+contentKey\s*=\s*['"]([^'"]+)['"]/,
                /window\.contentKey\s*=\s*['"]([^'"]+)['"]/,
                /contentKey\s*=\s*['"]([^'"]+)['"]/
            ];
            for (let pattern of contentKeyPatterns) {
                let match = html.match(pattern);
                if (match && match[1]) {
                    contentKey = match[1];
                    break;
                }
            }
            
            let cct = '';
            let cctPatterns = [
                /(?:var|let|const)\s+cct\s*=\s*['"]([^'"]+)['"]/,
                /window\.cct\s*=\s*['"]([^'"]+)['"]/,
                /cct\s*=\s*['"]([^'"]+)['"]/
            ];
            for (let pattern of cctPatterns) {
                let match = html.match(pattern);
                if (match && match[1]) {
                    cct = match[1];
                    break;
                }
            }
            
            if (contentKey && cct && contentKey.length > 16) {
                try {
                    console.log('Decrypting with contentKey length: ' + contentKey.length + ', cct: ' + cct.substring(0, 10) + '...');
                    let ivStr = contentKey.substring(0, 16);
                    let cipherStr = contentKey.substring(16);
                    
                    let keyBytes = Convert.encodeUtf8(cct);
                    let ivBytes = Convert.encodeUtf8(ivStr);
                    
                    let cipherBytes;
                    if (/^[0-9a-fA-F]+$/.test(cipherStr) && cipherStr.length % 2 === 0) {
                        console.log('Using hex decoding for cipher');
                        let hexBytes = new Uint8Array(cipherStr.length / 2);
                        for (let i = 0; i < cipherStr.length; i += 2) {
                            hexBytes[i / 2] = parseInt(cipherStr.substring(i, i + 2), 16);
                        }
                        cipherBytes = hexBytes.buffer;
                    } else {
                        console.log('Using base64 decoding for cipher');
                        cipherBytes = Convert.decodeBase64(cipherStr);
                    }
                    
                    let plainBytes = Convert.decryptAesCbc(cipherBytes, keyBytes, ivBytes);
                    let plainText = Convert.decodeUtf8(plainBytes);
                    console.log('Decrypted text preview: ' + plainText.substring(0, 100));
                    
                    // Remove PKCS7 padding
                    let paddingLength = plainBytes[plainBytes.length - 1];
                    if (paddingLength > 0 && paddingLength <= 16) {
                        let validPadding = true;
                        for (let i = 0; i < paddingLength; i++) {
                            if (plainBytes[plainBytes.length - 1 - i] !== paddingLength) {
                                validPadding = false;
                                break;
                            }
                        }
                        if (validPadding) {
                            plainBytes = plainBytes.slice(0, plainBytes.length - paddingLength);
                            plainText = Convert.decodeUtf8(plainBytes);
                        }
                    }
                    
                    // Try to find valid JSON in the decrypted text
                    let jsonMatch = plainText.match(/\[.*\]/s);
                    if (jsonMatch) {
                        plainText = jsonMatch[0];
                    }
                    
                    console.log('Processed text preview: ' + plainText.substring(0, 100));
                    let parsed = JSON.parse(plainText);
                    
                    if (Array.isArray(parsed)) {
                        for (let item of parsed) {
                            let url = '';
                            if (typeof item === 'string') {
                                url = item;
                            } else if (item && item.url) {
                                url = item.url;
                            }
                            if (url) {
                                if (url.startsWith('//')) {
                                    url = 'https:' + url;
                                }
                                url = url.replace(/([./])c\d+x\.[a-zA-Z]+$/, `$1c${this.imageQuality}x.webp`);
                                images.push(url);
                            }
                        }
                    }
                } catch (e) {
                    console.log('Image decryption failed: ' + e);
                }
            }

            if (images.length === 0) {
                let selectors = [
                    '.comicContent-list img',
                    '.comic-content img',
                    '#comic-content img',
                    '.chapter-content img',
                    '.reader-content img',
                    '[class*="content"] img',
                    'img[data-src]',
                    'img[data-original]'
                ];
                for (let selector of selectors) {
                    let imgEls = doc.querySelectorAll(selector);
                    console.log(`Selector "${selector}" found ${imgEls.length} images`);
                    for (let i = 0; i < imgEls.length; i++) {
                        let img = imgEls[i];
                        let src = '';
                        if (img.attributes) {
                            src = img.attributes['src'] || img.attributes['data-src'] || img.attributes['data-original'] || '';
                        }
                        if (src && !src.includes('placeholder') && !src.includes('loading')) {
                            if (src.startsWith('//')) {
                                src = 'https:' + src;
                            }
                            src = src.replace(/([./])c\d+x\.[a-zA-Z]+$/, `$1c${this.imageQuality}x.webp`);
                            images.push(src);
                        }
                    }
                    if (images.length > 0) break;
                }
            }

            if (images.length === 0) {
                throw 'No images found in chapter';
            }

            return {
                images: images,
            };
        },
        loadComments: async (comicId, subId, page, replyTo) => {
            let url = `https://api.mangacopy.com/api/v3/comments?comic_id=${subId}&limit=20&offset=${(page - 1) * 20}`;
            if (replyTo) {
                url = url + `&reply_id=${replyTo}&_update=true`;
            }
            let res = await Network.get(
                url,
                {
                    ...this.webHeaders,
                    'Accept': 'application/json',
                }
            );

            if (res.status !== 200) {
                if (res.status === 210) {
                    throw "210：注冊用戶一天可以發5條評論"
                }
                throw `Invalid status code: ${res.status}`;
            }

            let data = JSON.parse(res.body);

            let total = data.results.total;

            return {
                comments: data.results.list.map(e => {
                    return {
                        userName: replyTo ? `${e.user_name}  👉  ${e.parent_user_name}` : e.user_name,
                        avatar: e.user_avatar,
                        content: e.comment,
                        time: e.create_at,
                        replyCount: e.count,
                        id: e.id,
                    }
                }),
                maxPage: (total - (total % 20)) / 20 + 1,
            }
        },
        sendComment: async (comicId, subId, content, replyTo) => {
            let token = this.loadData("token");
            if (!token) {
                throw "未登录"
            }
            if (!replyTo) {
                replyTo = '';
            }
            let res = await Network.post(
                `https://api.mangacopy.com/api/v3/member/comment`,
                {
                    ...this.webHeaders,
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
                    "Accept": "application/json",
                    "Authorization": `Token ${token}`,
                },
                `comic_id=${subId}&comment=${encodeURIComponent(content)}&reply_id=${replyTo}`,
            );

            if (res.status === 401) {
                error(`Login expired`);
                return;
            }

            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`;
            } else {
                return "ok"
            }
        },
        loadChapterComments: async (comicId, epId, page, replyTo) => {
            let url = `https://api.mangacopy.com/api/v3/roasts?chapter_id=${epId}&limit=20&offset=${(page - 1) * 20}&_update=true`;
            let res = await Network.get(
                url,
                {
                    ...this.webHeaders,
                    'Accept': 'application/json',
                }
            );

            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`;
            }

            let data = JSON.parse(res.body);

            let total = data.results.total;

            return {
                comments: data.results.list.map(e => {
                    return {
                        userName: e.user_name,
                        avatar: e.user_avatar,
                        content: e.comment,
                        time: e.create_at,
                        replyCount: null,
                        id: null,
                    }
                }),
                maxPage: (total - (total % 20)) / 20 + 1,
            }
        },
        sendChapterComment: async (comicId, epId, content, replyTo) => {
            let token = this.loadData("token");
            if (!token) {
                throw "未登录"
            }
            let res = await Network.post(
                `${this.apiUrl}/api/v3/member/roast`,
                {
                    ...this.webApiHeaders,
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
                },
                `chapter_id=${epId}&roast=${encodeURIComponent(content)}`,
            );

            if (res.status === 401) {
                throw `Login expired`;
            }

            if (res.status !== 200) {
                if (res.status === 210) {
                    throw `210:评论过于频繁或评论内容过短过长`;
                }
                throw `Invalid status code: ${res.status}`;
            } else {
                return "ok"
            }
        },
        onClickTag: (namespace, tag) => {
            if (namespace === "标签") {
                return {
                    action: 'search',
                    keyword: `tag:${tag}`,
                    param: null,
                }
            }
            if (namespace === "作者") {
                return {
                    action: 'search',
                    keyword: `author:${tag}`,
                    param: null,
                }
            }
            throw "未支持此类Tag检索"
        }
    }

    settings = {
        favorites_ordering: {
            title: "收藏排序方式",
            type: "select",
            options: [
                {
                    value: '-datetime_updated',
                    text: '更新时间'
                },
                {
                    value: '-datetime_modifier',
                    text: '收藏时间'
                },
                {
                    value: '-datetime_browse',
                    text: '阅读时间'
                }
            ],
            default: '-datetime_updated',
        },
        region: {
            title: "CDN线路",
            type: "select",
            options: [
                {
                    value: "1",
                    text: '大陆线路'
                },
                {
                    value: "0",
                    text: '海外线路'
                },
            ],
            default: CopyManga.defaultCopyRegion,
        },
        image_quality: {
            title: "图片质量",
            type: "select",
            options: [
                {
                    value: '800',
                    text: '低 (800)'
                },
                {
                    value: '1200',
                    text: '中 (1200)'
                },
                {
                    value: '1500',
                    text: '高 (1500)'
                }
            ],
            default: CopyManga.defaultImageQuality,
        },
        search_api: {
            title: "搜索方式",
            type: "select",
            options: [
                {
                    value: 'baseAPI',
                    text: '基础API'
                },
                {
                    value: 'webAPI',
                    text: '网页端API'
                }
            ],
            default: 'baseAPI'
        },
        base_url: {
            title: "节点选择",
            type: "select",
            options: [
                {
                    value: 'www.2026copy.com',
                    text: '2026copy.com'
                },
                {
                    value: 'www.2025copy.com',
                    text: '2025copy.com'
                },
                {
                    value: 'www.copy20.com',
                    text: 'copy20.com'
                },
                {
                    value: 'www.mangacopy.com',
                    text: 'mangacopy.com'
                },
                {
                    value: 'www.copy-manga.com',
                    text: 'copy-manga.com'
                },
            ],
            default: CopyManga.defaultApiUrl,
        },

        
        // version: {
        //     title: "拷贝版本（重启APP生效）",
        //     type: "input",
        //     default: CopyManga.defaultCopyVersion,
        // },
        // platform: {
        //     title: "平台代号（重启APP生效）",
        //     type: "input",
        //     validator: '^\\d+(?:\\.\\d+)*$',
        //     default: CopyManga.defaultCopyPlatform,
        // },
    }

    /**
     * Check if the current app version is after the target version
     * @param target {string} target version
     * @returns {boolean} true if the current app version is after the target version
     */
    isAppVersionAfter(target) {
        let current = APP.version
        let targetArr = target.split('.')
        let currentArr = current.split('.')
        for (let i = 0; i < 3; i++) {
            if (parseInt(currentArr[i]) < parseInt(targetArr[i])) {
                return false
            }
        }
        return true
    }

    async refreshSearchApi() {
        let url = "https://www.copy20.com/search"
        let res = await fetch(url)
        let searchApi = ""
        if (res.status === 200) {
            let text = await res.text()
            let match = text.match(/const countApi = "([^"]+)"/)
            if (match && match[1]) {
                CopyManga.searchApi = match[1]
            }
        }
    }

    async refreshAppApi() {
        const url = "https://api.copy-manga.com/api/v3/system/network2?platform=2"
        const res = await fetch(url, { headers: this.webApiHeaders });
        if (res.status === 200) {
            let data = await res.json();
            this.settings.base_url = data.results.api[0][0];
        }
    }

    async runSpeedTest() {
        const hosts = [
            'www.2027copy.com',
            'www.2026copy.com',
            'www.2025copy.com',
            'www.copy20.com',
            'www.mangacopy.com',
            'www.copymanga.tv',
            'www.copy-manga.com',
            'www.copy2000.site',
            'www.copy2000.online',
        ];
        
        const results = {};
        
        for (const host of hosts) {
            const startTime = Date.now();
            try {
                const res = await Network.get(`https://${host}/`, {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                });
                const endTime = Date.now();
                const latency = endTime - startTime;
                
                if (res.status === 200) {
                    const body = res.body.toLowerCase();
                    const isValid = body.includes('content-box') || body.includes('swiperlist') || body.includes('comicrank');
                    results[host] = {
                        success: isValid,
                        latency: latency,
                        status: res.status
                    };
                } else {
                    results[host] = {
                        success: false,
                        latency: latency,
                        status: res.status
                    };
                }
            } catch (e) {
                results[host] = {
                    success: false,
                    latency: 999999,
                    status: 0
                };
            }
        }
        
        this.saveData("_speed_test_results", JSON.stringify(results));
        this.saveData("_speed_test_time", new Date().toISOString());
        
        let bestHost = null;
        let bestLatency = 999999;
        for (const [host, result] of Object.entries(results)) {
            if (result.success && result.latency < bestLatency) {
                bestLatency = result.latency;
                bestHost = host;
            }
        }
        
        if (bestHost) {
            this.saveData("_best_host", bestHost);
        }
    }

    getSpeedTestResults() {
        const results = this.loadData("_speed_test_results");
        const time = this.loadData("_speed_test_time");
        if (results) {
            return {
                results: JSON.parse(results),
                time: time
            };
        }
        return null;
    }
}
