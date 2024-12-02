import { Browser, Page } from "puppeteer";
import { getProxy, loadProxy, Proxy, proxyCount } from "./proxy";
import {
  createBulk,
  getDateRangeBy,
  getOldestData,
  parseDate,
} from "./elasticsearch";
import axios from "axios";
import { createBrowser, parseProduct, sleep } from "./wipo";
import { TrademarkInfo } from "./interface";
import winston from "winston";
import { HttpProxyAgent } from "http-proxy-agent";
import { createLogger, setLevel } from "./logger";
import minimist from "minimist";

const DETAIL_PAGE = `http://wipopublish.ipvietnam.gov.vn/wopublish-search/public/ajax/detail/trademarks?id=`;

class AppBrowser {
  constructor(
    private browser: Browser,
    private proxy: Proxy | null,
    private logger: winston.Logger
  ) {}

  async start() {
    while (true) {
      const startTime = new Date();

      const docs = await getOldestData(proxyCount());
      this.logger.debug(
        "docs: " + docs.length + " | proxy count: " + proxyCount()
      );
      const items = await Promise.all(
        docs.map((doc) => {
          return this.getDetail(doc);
        })
      );

      const diff = [];
      for (let i = 0; i < docs.length; i++) {
        if (docs[i].txs && docs[i].txs.length != items[i].txs.length) {
          diff.push(docs[i].application_number);
        }
      }

      await createBulk(items);

      const endTime = new Date();
      const seconds = Math.floor(
        (endTime.getTime() - startTime.getTime()) / 1000
      );
      this.logger.info(
        `date: ${items[0].applicationDate} | done: ${
          docs.length
        } docs in ${seconds} s | changed: ${diff.join(",")}`
      );
      await sleep(1000);
    }
  }

  //   async getHtml() {
  //     let proxy = getProxy(1);

  //     const httpAgent = proxy
  //       ? new HttpProxyAgent(
  //           `http://${proxy.user}:${proxy.password}@${proxy.server}`
  //         )
  //       : null;

  //   }

  async getDetail(doc: {
    application_number: string;
    application_date: string;
  }) {
    let proxy = getProxy(1);

    const httpAgent = proxy
      ? new HttpProxyAgent(
          `http://${proxy.user}:${proxy.password}@${proxy.server}`
        )
      : null;

    while (true) {
      const id = doc.application_number.replace(/-/g, "");

      const response = await axios.get(DETAIL_PAGE + id, {
        httpAgent: httpAgent ? httpAgent : undefined,
      });
      this.logger.debug(
        "get tradenark: " +
          doc.application_number +
          " | proxy:" +
          (proxy ? proxy.server : "192.168.1.1")
      );
      const detailPage = await this.browser.newPage();
      await detailPage.setContent(response.data);
      try {
        const item = await this.parseItem(detailPage);
        if (item && this.isProduct(doc.application_date, item)) {
          return item;
        }
      } catch (e: any) {
        this.logger.debug(e.message);
      } finally {
        await detailPage.close();
      }
    }
  }

  async parseItem(page: Page): Promise<TrademarkInfo | null> {
    return parseProduct(page);
  }

  isProduct(date: string, product: TrademarkInfo | null | undefined) {
    return isProduct(product, date);
  }
}

function isValidApplicationNumber(
  applicationNumber: string | null | undefined
): boolean {
  return !!applicationNumber && !applicationNumber.includes("${");
}

function isSameDate(date1: string | null | undefined, date2: string): boolean {
  const parsedDate1 = parseDate(date1 || undefined)?.getTime();
  const parsedDate2 = new Date(date2).getTime();
  return parsedDate1 === parsedDate2;
}

function isProduct(
  product: TrademarkInfo | null | undefined,
  date: string
): boolean {
  if (!product) return false;
  return (
    isValidApplicationNumber(product.applicationNumber)
  );
}

export async function runApp() {
  const args = minimist(process.argv.slice(2));
  setLevel(args.debug ? "debug" : "info");
  await loadProxy();
  while (true) {
    const [browser, proxy] = await createBrowser(1, args.open ? false : true);
    try {
      const logger = createLogger("");
      const appBrowser = new AppBrowser(browser, proxy, logger);
      await appBrowser.start();
    } finally {
      await browser.close();
    }
  }
}
