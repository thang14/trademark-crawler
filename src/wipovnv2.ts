import { Browser, Page } from "puppeteer";
import {
  checkDateRange,
  clickDateFilter,
  createBrowser,
  isNoData,
  newPage,
  parseProduct,
  sleep,
  waitHideLoading,
} from "./wipo";
import { loadProxy, Proxy } from "./proxy";
import minimist from "minimist";
import { createLogger, setLevel } from "./logger";
import {
  createDateEveryday,
  createDateRange,
  createPages,
  finalPage,
  getCrawledItemsCount,
  getPage,
  getPages,
  getQueue,
  incItemCount,
  incPageItemCount,
  resetCrawl,
  updateCrawl,
} from "./leveldb";
import pLimit from "p-limit";
import { TrademarkGlobal, TrademarkInfo } from "./interface";
import {
  countDate,
  createBulk,
  createBulkGlobal,
  setDateRangeBy,
} from "./elasticsearch";
import winston, { Logger } from "winston";
import { HttpProxyAgent } from "http-proxy-agent";
import { ProxyAgent } from "proxy-agent";
import axios from "axios";
const ROW_PER_PAGE = 50;

const statusMap: { [key: string]: string } = {
  "No longer in effect": "Hết hạn",
  "Protection granted": "Cấp bằng",
  "Provisionally refused": "Từ chối",
  "Awaiting decision": "Đang giải quyết",
};

const PAGEURL = `http://wipopublish.ipvietnam.gov.vn/wopublish-search/public/trademarks?query=*:*`;
const DETAIL_PAGE = `http://wipopublish.ipvietnam.gov.vn/wopublish-search/public/ajax/detail/trademarks?id=`;
const args = minimist(process.argv.slice(2));

class AppBrowser {
  page: Page | undefined;
  dateRangeArr: string[];
  lastId: string = "";
  agent: ProxyAgent | null = null;
  constructor(
    private logger: winston.Logger,
    private browser: Browser,
    private proxy: Proxy | null,
    private dataRange: string,
    private start: number
  ) {
    this.dateRangeArr = dataRange.split("TO").map((d) => {
      const [year, month, day] = d.trim().split("-");
      return `${day}.${month}.${year}`;
    });

    if (this.proxy) {
      this.agent = new ProxyAgent({
        httpAgent: new HttpProxyAgent(
          `http://${this.proxy.user}:${this.proxy.password}@${this.proxy.server}`
        ),
      });
    }
  }

  async typeAndSubmitSearch() {
    const inputSelector = 'input[placeholder="ví dụ 31.12.2017"]';
    await this.page!.waitForSelector("#advancedSearchForm");
    await clickDateFilter(this.page!);
    await waitHideLoading(this.page!);
    await this.page!.waitForSelector(inputSelector);
    await sleep(1000);
    await this.page!.type(inputSelector, this.dataRange);
    await sleep(1000);
    await this.page!.click("#advanceSearchButton", { count: 2 });
    await waitHideLoading(this.page!);
    await sleep(1000);
  }

  async parseSearchResults() {
    const navSelector = "#dataTable .results-display-text div";
    await this.page!.waitForSelector(navSelector);
    // Lấy phần tử chứa thông tin kết quả
    const navDetails = await this.page!.evaluate((navSelector) => {
      const resultText = document
        .querySelector(navSelector)
        ?.textContent?.trim();
      // Sử dụng biểu thức chính quy để tách thông tin
      const match = resultText?.match(/Showing (\d+) - (\d+) of (\d+) results/);

      if (match) {
        return {
          start: parseInt(match[1], 10), // Số bắt đầu
          end: parseInt(match[2], 10), // Số kết thúc
          total: parseInt(match[3], 10), // Tổng số kết quả
        };
      } else {
        return null;
      }
    }, navSelector);

    if (!navDetails) throw new Error("parse navigation detail error");
    return navDetails;
  }

  async clickPage(pageNumber: number) {
    let retry = 3;
    while (retry > 0) {
      try {
        const pageTitle = `title="Go to page ${pageNumber}"`;
        this.logger.debug(`Go to page ${pageNumber}`);
        await this.page!.click(`a[${pageTitle}]`);
        await this.page?.waitForSelector(`span[${pageTitle}]`, {
          timeout: 10000,
        });
        await sleep(1000);
        return;
      } catch {
      } finally {
        retry--;
      }
    }
    throw new Error("click page error: " + pageNumber);
  }

  async toPage(pageNumber: number) {
    if (pageNumber == 1) return;
    while (true) {
      await sleep(1000);
      const pageTitle = `title="Go to page ${pageNumber}"`;
      const hasPageE = await this.page!.$(`a[${pageTitle}]`);
      if (hasPageE) {
        await this.clickPage(pageNumber);
        const navDetails = await this.parseSearchResults();
        const matchStart = (pageNumber - 1) * 50 + 1;
        if (navDetails.start != matchStart) {
          throw new Error(
            `next page error: ${navDetails.start} not match ${matchStart}`
          );
        }
        break;
      } else {
        const pageButtons = await this.page!.$$(".paginator a");
        const lastPage = pageButtons[pageButtons.length - 3];
        await lastPage.click();
        const title = await lastPage.evaluate((e) => e.getAttribute("title"));
        this.logger.debug(title);
      }
    }
    await sleep(2000);
  }

  async getDetail(id: string, lastItemId: string | null) {
    let retry = 10;
    while (retry > 0) {
      const detailPage = await newPage(
        this.browser,
        this.proxy,
        DETAIL_PAGE + id
      );
      try {
        const item = await this.parseItem(detailPage);
        if (item && isProduct(item, lastItemId, this.dateRangeArr)) {
          return item;
        }
      } catch (e: any) {
        this.logger.debug(e.message);
      } finally {
        await detailPage.close();
      }
      retry--;
    }
    throw new Error("parse item error");
  }

  async getDetail2(id: string) {
    let retry = 10;
    while (retry > 0) {
      const response = await axios.get(DETAIL_PAGE + id, {
        httpAgent: this.agent ? this.agent.httpAgent : undefined,
      });
      const detailPage = await this.browser.newPage();
      await detailPage.setContent(response.data);
      try {
        const item = await this.parseItem(detailPage);
        if (item && this.isProduct(item)) {
          return item;
        }
      } catch (e: any) {
        this.logger.debug(e.message);
      } finally {
        await detailPage.close();
      }
      retry--;
    }
    throw new Error("parse item error");
  }

  async search(): Promise<[number, boolean]> {
    this.page = await newPage(this.browser, this.proxy, PAGEURL);
    await this.typeAndSubmitSearch();
    if (await isNoData(this.page)) {
      this.logger.info(`done: no datata found`);
      return [0, false];
    }
    const rowsSelector = "#resultWrapper tbody tr";
    await this.page.waitForSelector(rowsSelector);
    await sleep(1000);

    const navDetails = await this.parseSearchResults();
    if (this.start >= navDetails.total) {
      this.logger.info(`done: ${this.start}/${navDetails.total}`);
      return [navDetails.total, false];
    }
    const pageNumber = Math.floor(this.start / ROW_PER_PAGE) + 1;
    await this.toPage(pageNumber);
    const rows = await this.page.$$(rowsSelector);
    const nextRow = this.start - (pageNumber - 1) * ROW_PER_PAGE;
    const dbCount = await countDate(this.dataRange);
    const uncrawlItemCount = navDetails.total - this.start + nextRow;
    const rowPerPage =
      uncrawlItemCount > ROW_PER_PAGE ? ROW_PER_PAGE : uncrawlItemCount;
    this.logger.info(
      `progress: ${this.start}/${navDetails.total} page: ${pageNumber}, rows: ${nextRow}/${rowPerPage}, db: ${dbCount}`
    );
    let doneCount = nextRow;
    const ids = await Promise.all(
      rows.map((row) => {
        return row.evaluate((e) => e.id);
      })
    );

    for (let i = doneCount; i < ids.length; i++) {
      const item = await this.getDetail2(ids[i]);
      await createBulk([item]);
      await incItemCount(this.dataRange);
      this.lastId = item.applicationNumber;
      doneCount++;
      this.logger.debug(
        `crawled id: ${this.lastId} date: ${item?.applicationDate} | ${doneCount}/${rowPerPage}`
      );
    }

    // while (true) {
    //   await sleep(1000);
    //   if (isFirst) {
    //     await rows[nextRow].click();
    //     isFirst = false;
    //   } else {
    //     await this.page.click("button.slick-next");
    //   }
    //   await sleep(1000);
    //   await this.page.waitForSelector(".detail-wrapper");

    //   const item = await this.parseItem();
    //   if (!isProduct(item, lastItemId)) {
    //     throw new Error("cannot parse item");
    //   }
    //   await createBulk([item!]);
    //   await incItemCount(this.dataRange);
    //   lastItemId = item!.applicationNumber;
    //   doneCount++;

    //   this.logger.debug(
    //     `crawled item id: ${lastItemId} date: ${item?.applicationDate} | ${doneCount}/${rowPerPage}`
    //   );
    //   if (doneCount == rowPerPage) {
    //     break;
    //   }
    // }
    const newDbCount = await countDate(this.dataRange);
    if (newDbCount < this.start + doneCount - nextRow) {
      await resetCrawl(this.dataRange);
      this.logger.error(
        `db count does't match with done count ${dbCount}/${
          this.start + doneCount
        }, needed recrawl`
      );
      return [navDetails.total, true];
    }
    return [navDetails.total, false];
  }

  async parseItem(page?: Page): Promise<TrademarkInfo | null> {
    return parseProduct(page || this.page!);
  }

  isProduct(product: TrademarkInfo | null | undefined) {
    return isProduct(product, this.lastId, this.dateRangeArr);
  }
}

function isProduct(
  product: TrademarkInfo | null | undefined,
  lastId: string | null,
  dateRange: string[]
) {
  return (
    product &&
    product.applicationNumber &&
    !product.applicationNumber.includes("${") &&
    product.applicationNumber != lastId &&
    checkDateRange(product, dateRange)
  );
}

async function search(dateRange: string, headless: boolean, index: number) {
  let isRecrawl = false;
  async function getNext() {
    if (isRecrawl) return await getCrawledItemsCount(dateRange);
    return args.countdb
      ? await countDate(dateRange)
      : await getCrawledItemsCount(dateRange);
  }

  while (true) {
    const next = await getNext();
    const [browser, proxy] = await createBrowser(index, headless);
    const proxyServer = proxy ? proxy.server : "192.16.11.1:57432";
    const logger = createLogger(`range: ${dateRange} proxy:` + proxyServer);
    try {
      const appBrowser = new AppBrowser(
        logger,
        browser,
        proxy,
        dateRange,
        next
      );
      const [total, recrawl] = await appBrowser.search();
      if (recrawl) {
        await resetCrawl(dateRange);
        isRecrawl = true;
        continue;
      }

      const dbCount = await countDate(dateRange);
      if (dbCount >= total) {
        await updateCrawl(dateRange, 0, true);
        logger.info(`done: ${dbCount}/${total}`);
        break;
      }

      const itemCount = await getNext();
      if (total === itemCount) {
        const dbCount = await countDate(dateRange);
        if (dbCount >= total) {
          await updateCrawl(dateRange, 0, true);
          logger.info(`done: ${dbCount}/${total}`);
          break;
        }
        await resetCrawl(dateRange);
        isRecrawl = true;
        logger.error(
          `db count does't match with total ${dbCount}/${total}, needed recrawl`
        );
      }
    } catch (e: any) {
      logger.debug(e.message);
    } finally {
      await browser.close();
    }
  }
}

export async function runCrawl() {
  const args = minimist(process.argv.slice(2));
  setLevel(args.debug ? "debug" : "info");

  if (args.daterangeby) {
    setDateRangeBy(args.daterangeby);
    console.log("daterangeby:", args.daterangeby);
  }

  if (args.daterange) {
    await createDateRange(args.daterange);
    console.log("created date range", args.daterange);
  }

  if (args.everyday) {
    await createDateEveryday();
    console.log("created date everyday");
  }
  await loadProxy();
  const queues = await getQueue();
  const maxQueue = args.limit || 1;
  console.log("queues:", queues.length, "wipovn-v2");
  const limit = pLimit(maxQueue);
  const promises: any[] = [];
  for (let i = 0; i < queues.length; i++) {
    promises.push(
      limit(() => search(queues[i].key, args.open ? false : true, i))
    ); // Gọi hàm search với ngày hiện tại
  }

  try {
    await Promise.all(promises);
    console.log("Hoàn tất tất cả tiến trình.");
  } catch (err) {
    console.error("Lỗi:", err);
  }
}
