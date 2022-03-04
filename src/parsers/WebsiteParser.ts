import { Parser } from './Parser';
import { Note } from './Note';
import { App, Notice, request } from 'obsidian';
import { getBaseUrl } from '../helpers';
import { isProbablyReaderable, Readability } from '@mozilla/readability';
import { ReadItLaterSettings } from '../settings';
import * as DOMPurify from 'isomorphic-dompurify';
import { parseHtmlContent } from './parsehtml';

type Article = {
    title: string;
    content: string;
};

class WebsiteParser extends Parser {
    constructor(app: App, settings: ReadItLaterSettings) {
        super(app, settings);
    }

    test(url: string): boolean {
        return this.isValidUrl(url);
    }

    async prepareNote(url: string): Promise<Note> {
        const response = await request({ method: 'GET', url });
        const document = new DOMParser().parseFromString(response, 'text/html');

        // Set base to allow Readability to resolve relative path's
        const baseEl = document.createElement('base');
        baseEl.setAttribute('href', getBaseUrl(url));
        document.head.append(baseEl);
        const cleanDocumentBody = DOMPurify.sanitize(document.body.innerHTML);
        document.body.innerHTML = cleanDocumentBody;

        if (!isProbablyReaderable(document)) {
            new Notice('@mozilla/readability considers this document to unlikely be readerable.');
        }
        const readableDocument = new Readability(document).parse();

        return readableDocument?.content
            ? await this.parsableArticle(this.app, readableDocument, url)
            : this.notParsableArticle(url);
    }

    private async parsableArticle(app: App, article: Article, url: string) {
        const title = article.title || 'No title';
        const content = await parseHtmlContent(app, article.content, this.settings.assetsDir);

        const processedContent = this.settings.parsableArticleNote
            .replace(/%articleTitle%/g, title)
            .replace(/%articleURL%/g, url)
            .replace(/%articleContent%/g, content);

        const fileName = `${title}.md`;
        return new Note(fileName, processedContent);
    }

    private notParsableArticle(url: string) {
        console.error('Website not parseable');

        const content = this.settings.notParsableArticleNote.replace('%articleURL%', url);

        const fileName = `Article (${this.getFormattedDateForFilename()}).md`;
        return new Note(fileName, content);
    }
}

export default WebsiteParser;
