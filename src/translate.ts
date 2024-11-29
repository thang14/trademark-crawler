import { Browser, Page } from "puppeteer";
import { Proxy } from "./proxy";
import { createBrowser, newPage, sleep } from "./wipo";

const PAGEURL = "https://translate.google.com/?sl=en&tl=vi&op=translate";
const SOURCE_SELECTOR = 'textarea[aria-label="Source text"]';
const RESULT_SELECTOR = ".ryNqvb";

class AppBrowser {
  browser: Browser;
  page: Page | undefined;
  proxy: Proxy | null;

  constructor(browser: Browser, proxy: Proxy | null) {
    this.browser = browser;
    this.proxy = proxy;
  }

  async newPage() {
    this.page = await newPage(this.browser, this.proxy, PAGEURL);
  }

  async translate(sourceText: string): Promise<string> {
    if (!this.page) {
      this.page = await newPage(this.browser, this.proxy, PAGEURL);
    }

    await this.page.click(SOURCE_SELECTOR, { count: 3 });

    // detect the source textarea for input data (source string)
    await this.page.waitForSelector(SOURCE_SELECTOR);
    await sleep(1000);

    // string that we want to translate and type it on the textarea
    await this.page.type(SOURCE_SELECTOR, sourceText);

    // wait for the result container available
    await this.page.waitForSelector(RESULT_SELECTOR);
    await sleep(3000);

    // get the result string (translated text)
    const translatedResult = await this.page.evaluate((RESULT_SELECTOR) => {
      const results = document.querySelectorAll(RESULT_SELECTOR);
      const resultText = [];
      for (let result of results) {
        resultText.push(result.textContent?.trim());
      }
      return resultText.join(" ");
    }, RESULT_SELECTOR);

    await sleep(3000);
    return translatedResult;
  }

  async translates(sourceTexts: string[]) {
    const results: string[] = [];
    for (let sourceText of sourceTexts) {
      results.push(await this.translate(sourceText));
    }
    return results;
  }
}

export async function runCrawl() {
  const browserRegistry = new BrowserRegistry(true);
  await browserRegistry.createBrowsers(10);

  while(true) {
    console.log(
        await browserRegistry.translateAll([
          ["shoes 1", "shoes 2", "shoes 3"],
          ["shoes 4", "shoes 5", "shoes 6"],
          ["shoes 1", "shoes 2", "shoes 3"],
          ["shoes 4", "shoes 5", "shoes 6"],
          ["shoes 1", "shoes 2", "shoes 3"],
          ["shoes 4", "shoes 5", "shoes 6"],
          ["shoes 1", "shoes 2", "shoes 3"],
          ["shoes 4", "shoes 5", "shoes 6"],
          ["shoes 1", "shoes 2", "shoes 3"],
          ["shoes 4", "shoes 5", "shoes 6"],
        ])
      );
  }

  await browserRegistry.closeAllBrowsers();
}

// BrowserRegistry.ts
type BrowserInstance = {
  index: number;
  appBrowser: AppBrowser;
  isBusy: boolean; // Trạng thái bận của trình duyệt
};

export class BrowserRegistry {
  private browsers: Map<number, BrowserInstance> = new Map();
  constructor(private headless: boolean) {}

  async createBrowsers(num: number) {
    const promises = [];
    for (let i = 0; i < num; i++) {
      promises.push(this.getOrCreateBrowser(i));
    }
    await Promise.all(promises);
  }

  // Hàm để khởi tạo hoặc lấy trình duyệt nếu đã có
  async getOrCreateBrowser(index: number): Promise<AppBrowser> {
    if (this.browsers.has(index)) {
      return this.browsers.get(index)!.appBrowser;
    }

    const appBrowser = await this.createNewBrowser(index);

    let retry = 3;
    while (retry > 0) {
      try {
        await appBrowser.newPage();
        retry = 0;
      } catch {
        retry--;
      }
    }

    this.browsers.set(index, { index, appBrowser, isBusy: false });
    return appBrowser;
  }

  // Hàm để khởi tạo một trình duyệt mới
  private async createNewBrowser(index: number): Promise<AppBrowser> {
    const [browser, proxy] = await createBrowser(index, this.headless);
    return new AppBrowser(browser, proxy);
  }

  // Hàm để dịch văn bản bằng cách gọi translate trên tất cả các trình duyệt
  async translateAll(texts: string[][]): Promise<string[][]> {
    const promises = [];
    for (let i = 0; i < texts.length; i++) {
      promises.push(this.translate(texts[i]));
    }
    return await Promise.all(promises);
  }

  async translate(texts: string[]): Promise<string[]> {
    let translated: string[] = [];
    let isTranslated = false;

    while (!isTranslated) {
      for (const browserInstance of this.browsers.values()) {
        if (!browserInstance.isBusy) {
          browserInstance.isBusy = true; // Đánh dấu trình duyệt đang bận
          try {
            translated = await browserInstance.appBrowser.translates(texts); // Dịch văn bản
            isTranslated = true; // Đánh dấu đã dịch thành công
          } finally {
            browserInstance.isBusy = false; // Đánh dấu trình duyệt rảnh
          }
          break; // Ra khỏi vòng lặp sau khi dịch thành công
        }
      }

      // Nếu chưa dịch thành công, chờ và kiểm tra lại
      if (!isTranslated) {
        await sleep(1000); // Chờ 1 giây trước khi thử lại
      }
    }

    return translated; // Trả về kết quả dịch
  }

  // Hàm đóng tất cả các trình duyệt
  async closeAllBrowsers(): Promise<void> {
    for (const { appBrowser } of this.browsers.values()) {
      await appBrowser.browser.close();
    }
    this.browsers.clear();
  }
}
