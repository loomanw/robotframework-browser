import { sendUnaryData, ServerUnaryCall, Server, ServerCredentials } from 'grpc';
import { chromium, firefox, webkit, Browser, BrowserContext, Page } from 'playwright';

import * as browserControl from './browser-control';
import * as getters from './getters';
import * as interaction from './interaction';
import { IPlaywrightServer, PlaywrightService } from './generated/playwright_grpc_pb';
import { Response, Request } from './generated/playwright_pb';

import { emptyWithLog } from './response-util';

declare global {
    interface Window {
        __SET_RFBROWSER__: <T>(a: T) => T;
        __RFBROWSER__: any;
    }
}

// This is necessary for improved typescript inference
/*
 * If obj is not trueish call callback with new Error containing message
 */
function exists<T1, T2>(obj: T1, callback: sendUnaryData<T2>, message: string): asserts obj is NonNullable<T1> {
    if (!obj) {
        callback(new Error(message), null);
    }
}

// Can't have an async constructor, this is a workaround
async function createBrowserState(
    browserType: string,
    headless: boolean,
    hideRfBrowser: boolean,
): Promise<BrowserState> {
    let browser;
    if (browserType === 'firefox') {
        browser = await firefox.launch({ headless: headless });
    } else if (browserType === 'chromium') {
        browser = await chromium.launch({ headless: headless });
    } else if (browserType === 'webkit') {
        browser = await webkit.launch({ headless: headless });
    } else {
        throw new Error('unsupported browser');
    }
    const context = await browser.newContext();
    if (!hideRfBrowser) {
        context.addInitScript(function () {
            window.__SET_RFBROWSER__ = function (state: any) {
                window.__RFBROWSER__ = state;
                return state;
            };
        });
    }
    context.setDefaultTimeout(parseFloat(process.env.TIMEOUT || '10000'));
    const page = await context.newPage();
    return new BrowserState(browser, context, page);
}

class BrowserState {
    constructor(browser: Browser, context: BrowserContext, page: Page) {
        this.browser = browser;
        this.context = context;
        this.page = page;
    }
    browser: Browser;
    context: BrowserContext;
    page: Page;
}

class PlaywrightServer implements IPlaywrightServer {
    private browserState?: BrowserState;

    async closeBrowser(call: ServerUnaryCall<Request.Empty>, callback: sendUnaryData<Response.Empty>): Promise<void> {
        browserControl.closeBrowser(callback, this.browserState?.browser);
        this.browserState = undefined;
        callback(null, emptyWithLog('Closed browser'));
    }

    async openBrowser(
        call: ServerUnaryCall<Request.NewBrowser>,
        callback: sendUnaryData<Response.Empty>,
    ): Promise<void> {
        const browserType = call.request.getBrowser();
        const url = call.request.getUrl();
        const headless = call.request.getHeadless();
        console.log('Open browser: ' + browserType);
        this.browserState = await createBrowserState(browserType, headless, false);
        if (url) {
            await this.browserState.page.goto(url).catch((e) => callback(null, e));
            callback(null, emptyWithLog(`Successfully opened browser ${browserType} to ${url}.`));
        } else {
            callback(null, emptyWithLog(`Successfully opened browser ${browserType}.`));
        }
    }

    async goTo(call: ServerUnaryCall<Request.Url>, callback: sendUnaryData<Response.Empty>): Promise<void> {
        browserControl.goTo(call, callback, this.browserState?.page);
    }

    async goBack(call: ServerUnaryCall<Request.Empty>, callback: sendUnaryData<Response.Empty>): Promise<void> {
        browserControl.goBack(callback, this.browserState?.page);
    }

    async goForward(call: ServerUnaryCall<Request.Empty>, callback: sendUnaryData<Response.Empty>): Promise<void> {
        browserControl.goForward(callback, this.browserState?.page);
    }

    async takeScreenshot(
        call: ServerUnaryCall<Request.ScreenshotPath>,
        callback: sendUnaryData<Response.Empty>,
    ): Promise<void> {
        browserControl.takeScreenshot(call, callback, this.browserState?.page);
    }

    async setTimeout(call: ServerUnaryCall<Request.Timeout>, callback: sendUnaryData<Response.Empty>): Promise<void> {
        browserControl.setTimeout(call, callback, this.browserState?.context);
    }

    async addStyleTag(call: ServerUnaryCall<Request.StyleTag>, callback: sendUnaryData<Response.Empty>): Promise<void> {
        browserControl.addStyleTag(call, callback, this.browserState?.page);
    }

    async getTitle(call: ServerUnaryCall<Request.Empty>, callback: sendUnaryData<Response.String>): Promise<void> {
        getters.getTitle(callback, this.browserState?.page);
    }

    async getUrl(call: ServerUnaryCall<Request.Empty>, callback: sendUnaryData<Response.String>): Promise<void> {
        getters.getUrl(callback, this.browserState?.page);
    }

    async getTextContent(
        call: ServerUnaryCall<Request.ElementSelector>,
        callback: sendUnaryData<Response.String>,
    ): Promise<void> {
        getters.getTextContent(call, callback, this.browserState?.page);
    }

    async getSelectContent(
        call: ServerUnaryCall<Request.ElementSelector>,
        callback: sendUnaryData<Response.Select>,
    ): Promise<void> {
        getters.getSelectContent(call, callback, this.browserState?.page);
    }

    async getDomProperty(
        call: ServerUnaryCall<Request.ElementProperty>,
        callback: sendUnaryData<Response.String>,
    ): Promise<void> {
        getters.getDomProperty(call, callback, this.browserState?.page);
    }

    async getBoolProperty(
        call: ServerUnaryCall<Request.ElementProperty>,
        callback: sendUnaryData<Response.Bool>,
    ): Promise<void> {
        getters.getBoolProperty(call, callback, this.browserState?.page);
    }

    async selectOption(
        call: ServerUnaryCall<Request.SelectElementSelector>,
        callback: sendUnaryData<Response.Empty>,
    ): Promise<void> {
        interaction.selectOption(call, callback, this.browserState?.page);
    }

    async deselectOption(call: ServerUnaryCall<Request.ElementSelector>, callback: sendUnaryData<Response.Empty>) {
        interaction.deSelectOption(call, callback, this.browserState?.page);
    }

    async inputText(call: ServerUnaryCall<Request.TextInput>, callback: sendUnaryData<Response.Empty>): Promise<void> {
        interaction.inputText(call, callback, this.browserState?.page);
    }

    async typeText(call: ServerUnaryCall<Request.TypeText>, callback: sendUnaryData<Response.Empty>): Promise<void> {
        interaction.typeText(call, callback, this.browserState?.page);
    }

    async fillText(call: ServerUnaryCall<Request.FillText>, callback: sendUnaryData<Response.Empty>): Promise<void> {
        interaction.fillText(call, callback, this.browserState?.page);
    }

    async clearText(call: ServerUnaryCall<Request.ClearText>, callback: sendUnaryData<Response.Empty>): Promise<void> {
        interaction.clearText(call, callback, this.browserState?.page);
    }

    async press(call: ServerUnaryCall<Request.PressKeys>, callback: sendUnaryData<Response.Empty>): Promise<void> {
        interaction.press(call, callback, this.browserState?.page);
    }

    async click(
        call: ServerUnaryCall<Request.ElementSelector>,
        callback: sendUnaryData<Response.Empty>,
    ): Promise<void> {
        interaction.click(call, callback, this.browserState?.page);
    }

    async clickWithOptions(
        call: ServerUnaryCall<Request.ElementSelectorWithOptions>,
        callback: sendUnaryData<Response.Empty>,
    ): Promise<void> {
        interaction.clickWithOptions(call, callback, this.browserState?.page);
    }

    async focus(
        call: ServerUnaryCall<Request.ElementSelector>,
        callback: sendUnaryData<Response.Empty>,
    ): Promise<void> {
        interaction.focus(call, callback, this.browserState?.page);
    }

    async checkCheckbox(
        call: ServerUnaryCall<Request.ElementSelector>,
        callback: sendUnaryData<Response.Empty>,
    ): Promise<void> {
        interaction.checkCheckbox(call, callback, this.browserState?.page);
    }

    async uncheckCheckbox(
        call: ServerUnaryCall<Request.ElementSelector>,
        callback: sendUnaryData<Response.Empty>,
    ): Promise<void> {
        interaction.uncheckCheckbox(call, callback, this.browserState?.page);
    }

    async health(call: ServerUnaryCall<Request.Empty>, callback: sendUnaryData<Response.String>): Promise<void> {
        const response = new Response.String();
        response.setBody('OK');
        callback(null, response);
    }

    async highlightElements(
        call: ServerUnaryCall<Request.ElementSelectorWithDuration>,
        callback: sendUnaryData<Response.Empty>,
    ): Promise<void> {
        exists(this.browserState, callback, 'Tried to highlight elements, no open browser');
        const selector = call.request.getSelector();
        const duration = call.request.getDuration();
        await this.browserState.page
            .$$eval(
                selector,
                (elements, duration) => {
                    elements.forEach((e) => {
                        const d = document.createElement('div');
                        d.appendChild(document.createTextNode(''));
                        d.style.position = 'fixed';
                        const rect = e.getBoundingClientRect();
                        d.style.top = '' + rect.top + 'px';
                        d.style.left = '' + rect.left + 'px';
                        d.style.width = '' + rect.width + 'px';
                        d.style.height = '' + rect.height + 'px';
                        d.style.border = '1px solid red';
                        document.body.appendChild(d);
                        setTimeout(() => {
                            d.remove();
                        }, duration);
                    });
                },
                duration,
            )
            .catch((e) => callback(e, null));
    }

    async waitForElementsState(
        call: ServerUnaryCall<Request.ElementSelectorWithOptions>,
        callback: sendUnaryData<Response.Empty>,
    ): Promise<void> {
        interaction.waitForElementState(call, callback, this.browserState?.page);
    }

    async executeJavascriptOnPage(
        call: ServerUnaryCall<Request.JavascriptCode>,
        callback: sendUnaryData<Response.JavascriptExecutionResult>,
    ): Promise<void> {
        interaction.executeJavascriptOnPage(call, callback, this.browserState?.page);
    }

    async getPageState(
        call: ServerUnaryCall<Request.Empty>,
        callback: sendUnaryData<Response.JavascriptExecutionResult>,
    ): Promise<void> {
        interaction.getPageState(callback, this.browserState?.page);
    }
}

const server = new Server();
server.addService<IPlaywrightServer>(PlaywrightService, new PlaywrightServer());
const port = process.env.PORT || '0';
server.bind(`localhost:${port}`, ServerCredentials.createInsecure());
console.log(`Listening on ${port}`);
server.start();
