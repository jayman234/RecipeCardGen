const { app } = require('@azure/functions');
const cheerio = require('cheerio');

app.http('find-images', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {

        try {

            // ----------------------------------------
            // Get recipe URL
            // ----------------------------------------

            const recipeUrl = request.query.get('url');

            if (!recipeUrl) {
                return {
                    status: 400,
                    jsonBody: {
                        error: 'Please provide a recipe URL.'
                    }
                };
            }

            let url;

            try {
                url = new URL(recipeUrl);
            } catch {
                return {
                    status: 400,
                    jsonBody: {
                        error: 'Invalid recipe URL.'
                    }
                };
            }

            context.log('Fetching recipe page: ' + url.href);

            // ----------------------------------------
            // Download webpage
            // ----------------------------------------

            const response = await fetch(url.href, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36'
                }
            });

            if (!response.ok) {
                return {
                    status: 502,
                    jsonBody: {
                        error: 'Could not access the recipe website.',
                        status: response.status
                    }
                };
            }

            const html = await response.text();

            const $ = cheerio.load(html);

            const images = [];
            const imageKeys = new Set();

            // ----------------------------------------
            // Create a key representing the original image
            // ----------------------------------------

            function getImageKey(imageUrl) {

                try {

                    const parsed = new URL(imageUrl);

                    // Substack image proxy
                    if (parsed.hostname === 'substackcdn.com') {

                        const parts = parsed.pathname.split('/');

                        const encodedOriginal = parts[parts.length - 1];

                        if (encodedOriginal && encodedOriginal.includes('%')) {
                            return decodeURIComponent(encodedOriginal);
                        }
                    }

                    // Otherwise use the URL without query parameters
                    parsed.search = '';

                    return parsed.href;

                } catch {
                    return imageUrl;
                }
            }

            // ----------------------------------------
            // Add image helper
            // ----------------------------------------

            function addImage(imageUrl) {

                if (!imageUrl || typeof imageUrl !== 'string') {
                    return;
                }

                imageUrl = imageUrl.trim();

                if (!imageUrl) {
                    return;
                }

                try {

                    const absoluteUrl = new URL(imageUrl, url.href).href;

                    const parsed = new URL(absoluteUrl);

                    // --------------------------------
                    // Ignore obvious tiny images
                    // --------------------------------

                    const tinyPattern =
                        /(?:w|h)_(?:1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9]|6[0-9]|7[0-9]|8[0-9]|9[0-9])(?:[,_]|$)/;

                    if (tinyPattern.test(absoluteUrl)) {
                        return;
                    }

                    // Ignore common avatar paths
                    if (
                        absoluteUrl.includes('/avatars/') ||
                        absoluteUrl.includes('avatar')
                    ) {
                        return;
                    }

                    const key = getImageKey(absoluteUrl);

                    if (!imageKeys.has(key)) {

                        imageKeys.add(key);

                        images.push(absoluteUrl);

                    }

                } catch {
                    // Ignore invalid URLs
                }
            }

            // ----------------------------------------
            // 1. Open Graph image
            // ----------------------------------------

            $('meta[property="og:image"]').each((i, element) => {
                addImage($(element).attr('content'));
            });

            // ----------------------------------------
            // 2. Twitter image
            // ----------------------------------------

            $('meta[name="twitter:image"]').each((i, element) => {
                addImage($(element).attr('content'));
            });

            // ----------------------------------------
            // 3. JSON-LD images
            // ----------------------------------------

            $('script[type="application/ld+json"]').each((i, element) => {

                try {

                    const json = JSON.parse($(element).html());

                    function findImages(data) {

                        if (!data) {
                            return;
                        }

                        if (data.image) {

                            if (typeof data.image === 'string') {
                                addImage(data.image);
                            }

                            else if (Array.isArray(data.image)) {

                                data.image.forEach(image => {

                                    if (typeof image === 'string') {
                                        addImage(image);
                                    }

                                    else if (image && image.url) {
                                        addImage(image.url);
                                    }

                                });

                            }

                            else if (data.image.url) {
                                addImage(data.image.url);
                            }
                        }

                        if (Array.isArray(data)) {
                            data.forEach(item => findImages(item));
                        }

                        if (data['@graph']) {
                            findImages(data['@graph']);
                        }

                    }

                    findImages(json);

                } catch {
                    // Ignore invalid JSON-LD
                }

            });

            // ----------------------------------------
            // 4. Normal page images
            // ----------------------------------------

            $('img').each((i, element) => {

                addImage($(element).attr('src'));

                addImage($(element).attr('data-src'));

                addImage($(element).attr('data-lazy-src'));

                // --------------------------------
                // srcset
                // --------------------------------

                const srcset = $(element).attr('srcset');

                if (srcset) {

                    const entries =
                        srcset.split(/,(?=\s*(?:https?:)?\/\/)/);

                    entries.forEach(entry => {

                        const parts = entry.trim().split(/\s+/);

                        if (parts.length > 0) {
                            addImage(parts[0]);
                        }

                    });

                }

            });

            // ----------------------------------------
            // Limit results
            // ----------------------------------------

            const limitedImages = images.slice(0, 8);

            context.log('Found ' + limitedImages.length + ' unique images.');

            return {
                status: 200,
                jsonBody: {
                    images: limitedImages
                }
            };

        }

        catch (error) {

            context.error('Image finder error:', error);

            return {
                status: 500,
                jsonBody: {
                    error: 'Something went wrong while finding images.'
                }
            };

        }

    }
});