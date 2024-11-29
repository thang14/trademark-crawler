import { Browser, Page } from "puppeteer";
import { getProxy, Proxy, proxyCount } from "./proxy";
import { getDateRangeBy, getOldestData, parseDate } from "./elasticsearch";
import axios from "axios";
import { createBrowser, parseProduct } from "./wipo";
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
      const docs = await getOldestData(proxyCount());
      for (let doc of docs) {
        const item = await this.getDetail(doc);
        console.log(item);
      }
    }
  }

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
      this.logger.debug("get tradenark: " + doc.application_number);
      const response = await axios.get(DETAIL_PAGE + doc.application_number, {
        httpAgent: httpAgent ? httpAgent : undefined,
      });

      console.log(DETAIL_PAGE + doc.application_number, response.data);
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
    isValidApplicationNumber(product.applicationNumber) &&
    isSameDate(product.applicationDate, date)
  );
}

export async function runApp() {
  const args = minimist(process.argv.slice(2));
  setLevel(args.debug ? "debug" : "info");
  const [browser, proxy] = await createBrowser(1, args.open ? false : true);
  try {
    const proxyServer = proxy ? proxy.server : "192.16.11.1:57432";
    const logger = createLogger(`proxy:` + proxyServer);
    const appBrowser = new AppBrowser(browser, proxy, logger);
    await appBrowser.start();
  } finally {
    await browser.close();
  }
}
