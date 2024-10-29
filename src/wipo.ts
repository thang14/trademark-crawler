import pLimit from "p-limit";

import puppeteer from "puppeteer-extra";
import Stealth from "puppeteer-extra-plugin-stealth";
import fs, { fsync } from "fs";
import { Browser, Cookie, ElementHandle, Page } from "puppeteer";
import { countDate, tryCreateBulk, tryDeleteBulk } from "./elasticsearch";
import { TrademarkInfo } from "./interface";
import minimist from "minimist";
import winston, { log } from "winston";
import { createLogger, setLevel } from "./logger";
import {
  createDateRange,
  getCrawledItemsCount,
  getQueue,
  resetCrawl,
  tryUpdateCrawl,
  updateCrawl,
} from "./leveldb";
import { getProxy, loadProxy, Proxy } from "./proxy";

puppeteer.use(Stealth());

export let runQueues: any = {};
let maxQueue = 0;

interface SearchResult {
  start: number;
  end: number;
  total: number;
}

// let _cookies: Cookie[];

// async function getCookie(): Promise<Cookie[]> {
//   if (_cookies) return _cookies;
//   const browser = await puppeteer.launch({ headless: false });
//   const page = await browser.newPage();
//   await page.setViewport({ width: 1920, height: 1080 });
//   await page.goto(
//     `http://wipopublish.ipvietnam.gov.vn/wopublish-search/public/trademarks`
//   );
//   await page.waitForNetworkIdle(); // Wait for network resources to fully load
//   _cookies = await page.cookies();
//   await browser.close();
//   return _cookies;
// }

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function tryParseProduct(page: Page) {
  try {
    await page.waitForSelector(".product-details", { timeout: 10000 });
    await sleep(500);
    return await parseProduct(page);
  } catch {}
}

async function checkProductFinal(page: Page) {
  const text = await page.evaluate(() => {
    return document.querySelector("#detailsPanelContentDiv .detail-wrapper")
      ?.textContent;
  });
  return !text?.includes("${");
}

async function parseProduct(page: Page) {
  if (!(await checkProductFinal(page))) return null;
  // Bóc tách dữ liệu từ HTML
  return await page.evaluate(() => {
    const rows = document.querySelectorAll(".detail-container > .row");

    function cleanString(input: string) {
      // Loại bỏ khoảng trắng không cần thiết xung quanh và giữa các ký tự
      return input.replace(/\s*-\s*/g, "-").trim();
    }

    function parseCertificateInfo() {
      const doc = rows[2];
      const formDetails = doc.querySelectorAll(".product-form-details");
      // Lấy thông tin số bằng và ngày cấp
      const certificateNumberElement = formDetails[0].querySelector(
        "span:nth-of-type(1)"
      );
      const certificateDateElement = formDetails[0].querySelector(
        "span:nth-of-type(2)"
      );

      // Lấy thông tin trạng thái
      const statusElement = formDetails[1];

      // Lấy nội dung
      const certificateNumber = certificateNumberElement
        ? certificateNumberElement.textContent?.trim()
        : "";
      const certificateDate = certificateDateElement
        ? certificateDateElement.textContent?.trim()
        : "";
      const status = statusElement ? statusElement.textContent?.trim() : "";

      return {
        certificateNumber, // Số bằng
        certificateDate, // Ngày cấp
        status, // Trạng thái
      };
    }

    function parseApplicationInfo() {
      const doc = rows[4];
      const formDetails = doc.querySelectorAll(".product-form-details");

      // Lấy số đơn và ngày nộp đơn
      const applicationNumberElement =
        formDetails[0].querySelector(".margin-right-5");
      const applicationDateElement = formDetails[0].querySelector(
        "span:nth-of-type(2)"
      );

      // Lấy số công bố và ngày công bố
      const publicationNumberElement = formDetails[1].querySelector(
        ".col-md-4:nth-child(1)"
      );
      const publicationDateElement = formDetails[1].querySelector(
        ".col-md-4:nth-child(2)"
      );

      // Lấy nội dung
      const applicationNumber = applicationNumberElement
        ? applicationNumberElement.textContent?.trim()
        : "";
      const applicationDate = applicationDateElement
        ? applicationDateElement.textContent?.trim()
        : "";
      const publicationNumber = publicationNumberElement
        ? publicationNumberElement.textContent?.trim()
        : "";
      const publicationDate = publicationDateElement
        ? publicationDateElement.textContent?.trim()
        : "";

      return {
        applicationNumber: cleanString(applicationNumber || ""), // Số đơn
        applicationDate, // Ngày nộp đơn
        publicationNumber, // Số công bố
        publicationDate, // Ngày công bố
      };
    }

    function parseProductInfo() {
      // Lấy tất cả các hàng sản phẩm/dịch vụ
      const productRows = rows[7].querySelectorAll(
        ".product-form-details .row"
      );

      // Tạo cấu trúc dữ liệu để lưu thông tin
      const products = Array.from(productRows).map((row) => {
        const link = row.querySelector("a") as Element; // Lấy thẻ <a> chứa thông tin sản phẩm
        const code = link ? link.getAttribute("rel") : ""; // Mã sản phẩm từ thuộc tính rel
        const description = link
          ? link.querySelector(".col-md-10")?.textContent?.trim()
          : ""; // Mô tả sản phẩm

        return { code, description }; // Trả về đối tượng với mã và mô tả
      });

      return products; // Trả về danh sách sản phẩm
    }

    const getText = (row: number, div: number) => {
      return rows[row]
        .querySelectorAll("div")
        [div].textContent?.replace("\n", "")
        .trim()
        .replace("(VI)", "")
        .trim();
    };

    const getImageSrc = (selector: any) => {
      const element = document.querySelector(selector);
      return element ? element.src : "";
    };

    function parseClassificationOfShapesData(): Array<{
      code: string;
      number: string;
    }> {
      // Lấy tất cả các thẻ <a> trong phần phân loại hình
      const typeLinks = rows[8].querySelectorAll(
        ".product-form-details .external-link"
      );

      // Tạo cấu trúc dữ liệu để lưu thông tin mã
      const types = Array.from(typeLinks).map((link) => {
        const classification = link
          .querySelector(".ext-link-text")
          ?.textContent?.trim(); // Lấy mã loại hình
        const match = classification?.match(/^(\S+)\s+\((\d+)\)$/); // Tách mã và số trong ngoặc

        return {
          code: match ? match[1] : "", // Mã phân loại
          number: match ? match[2] : "", // Số trong ngoặc
        };
      });

      return types; // Trả về danh sách loại hình nhãn hiệu
    }

    function parseApplicantInfo(input: string | undefined) {
      if (!input) return "";
      // Tách tên và địa chỉ tại dấu ":"
      const [name, address] = input.split(":").map((part) => part.trim());

      return {
        name: name, // Tên chủ đơn
        address: address, // Địa chỉ
      };
    }

    return {
      //rows: rows[0].getHTML(),
      logo: getImageSrc(".rs-LOGO"), // URL của mẫu nhãn
      name: getText(5, 1),
      ...parseApplicationInfo(),
      applicationType: getText(1, 3),
      color: getText(5, 3),
      expiredDate: getText(3, 1),
      nices: parseProductInfo(),
      ...parseCertificateInfo(),
      classificationOfShapes: parseClassificationOfShapesData(),
      applicant: parseApplicantInfo(getText(9, 1)),
      ipRepresentative: parseApplicantInfo(getText(10, 1)),
      exclude: getText(14, 1),
      template: getText(13, 1),
      translation: getText(12, 1),
    } as TrademarkInfo;
  });
}

async function backToSearch(logger: winston.Logger, page: Page) {
  const selector = 'a[onclick="backToSearchSlide();"]';
  await page.waitForSelector(selector, {
    visible: true,
    timeout: 10000,
  });
  await sleep(100);
  const btn = await page.$(selector);
  await btn?.scrollIntoView();
  await btn?.click();
  logger.debug("click back");
}

async function showDetails(
  logger: winston.Logger,
  page: Page,
  handle: ElementHandle<HTMLTableRowElement>
) {
  await page.waitForSelector("#searchResultPanel");
  const showDetails = 'a[data-original-title="Hiển thị chi tiết"]';
  await handle.waitForSelector(showDetails, { visible: true });
  await sleep(200);
  const link = await handle.$(showDetails);
  await link?.scrollIntoView();
  await link?.click();
  logger.debug("click show detail");
}

function isProduct(
  product: TrademarkInfo | null | undefined,
  dateRange: string[],
  lastProduct: TrademarkInfo | null
) {
  return (
    product &&
    product.applicationNumber &&
    product.applicationDate &&
    dateRange.includes(product.applicationDate) &&
    !product.applicationNumber.includes("${") &&
    product.applicationNumber != lastProduct?.applicationNumber
  );
}

async function getProduct(
  logger: winston.Logger,
  page: Page,
  handle: ElementHandle<HTMLTableRowElement>,
  dateRanges: string[],
  lastProduct: TrademarkInfo | null,
): Promise<TrademarkInfo> {
  let retry = 5;
  let errMsg;
  while (retry > 0) {
    try {
      await showDetails(logger, page, handle);
      const product = await tryParseProduct(page);
      logger.debug(
        `${product?.applicationNumber} | ${product?.applicationDate}`
      );
      await backToSearch(logger, page);
      if (isProduct(product, dateRanges, lastProduct)) {
        return product!;
      }
      retry--;
    } catch (err: any) {
      errMsg = err;
      retry--;
    }
  }
  throw errMsg;
}

async function getProducts(
  logger: winston.Logger,
  page: Page,
  dateRange: string[]
): Promise<TrademarkInfo[]> {
  const handles = await page.$$("#resultWrapper tbody tr");
  const products: TrademarkInfo[] = [];
  let lastProduct: TrademarkInfo | null = null;
  for (let handle of handles) {
    lastProduct = await getProduct(logger, page, handle, dateRange, lastProduct);
    products.push(lastProduct);
  }
  return products;
}

//getDetails("VN4202328557")

async function parseSearchResults(page: Page) {
  await page.waitForSelector(".results-display-text");
  // Lấy phần tử chứa thông tin kết quả
  return page.evaluate(() => {
    const resultText = document
      .querySelector(".results-display-text div")
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
  });
}

async function typeAndSubmitSearch(
  page: Page,
  dataRANGE: string
): Promise<boolean> {
  await page.waitForSelector("#advancedSearchForm");
  await page.waitForSelector("#AFDT-filter");
  await page.click("#AFDT-filter");
  await waitHideLoading(page);
  await page.waitForSelector('input[placeholder="ví dụ 31.12.2017"]');
  await page.type('input[placeholder="ví dụ 31.12.2017"]', dataRANGE);
  await page.click("#advanceSearchButton");
  let retry = 3;
  let errMsg;
  while (retry > 0) {
    try {
      await page.click("#advanceSearchButton");
      await page.waitForSelector("#loadingDiv", {
        hidden: true,
      });
      await sleep(200);
      if (await isNoData(page)) {
        return true;
      }
      await page.waitForSelector("#resultWrapper tbody tr");
      await sleep(200);
      return false;
    } catch (e: any) {
      errMsg = e.message;
      retry--;
    }
  }
  throw new Error("submit search error: " + errMsg);
}

async function isNoData(page: Page) {
  return await page.evaluate(() => {
    const e = document.getElementById("noDataFoundLabel");
    return e?.checkVisibility();
  });
}

const tryUpdateResult = async (
  logger: winston.Logger,
  page: Page,
  start: number
) => {
  let retry = 3;
  while (retry > 0) {
    try {
      return await updateResult(logger, page, start);
    } catch {
      retry--;
    }
  }
  return null;
};

const updateResult = async (
  logger: winston.Logger,
  page: Page,
  start: number
) => {
  await page.waitForSelector(".paginator");
  await sleep(1000);
  const _searchResult = await parseSearchResults(page);
  if (!_searchResult || _searchResult.total === 0)
    throw new Error("Parse search results error");
  logger.debug(
    `try update result: ${_searchResult.start}/${_searchResult.total} - start: ${start}`
  );
  return _searchResult;
};

async function waitHideLoading(page: Page) {
  await page.waitForSelector("#loadingDiv", { hidden: true });
}

async function navigateThroughPages(
  logger: winston.Logger,
  page: Page,
  start: number
) {
  let searchResult = await tryUpdateResult(logger, page, start);
  if (!searchResult) return null;

  if (start >= searchResult.total) {
    return searchResult;
  }

  if (searchResult.end > start) {
    return searchResult;
  }

  while (true) {
    if (searchResult.start + 451 < start) {
      searchResult = await tryClickLastPage(logger, page, searchResult);
    } else {
      searchResult = await tryClickNextPage(logger, page, searchResult);
    }
    if (!searchResult) return null;
    logSearchResult(logger, searchResult, start);
    if (searchResult.end > start) {
      return searchResult;
    }
  }
}

async function tryClickNextPage(
  logger: winston.Logger,
  page: Page,
  searchResult: SearchResult
) {
  let retry = 3;
  while (retry > 0) {
    try {
      return await clickNextPage(logger, page, searchResult);
    } catch {
      retry--;
    }
  }
  logger.debug("try click next page not successfull ");
  return null;
}

async function clickNextPage(
  logger: winston.Logger,
  page: Page,
  searchResult: SearchResult
) {
  await page.waitForSelector('a[title="Go to next page"]', {
    visible: true,
    timeout: 10000,
  });
  const nextPage = await page.$('a[title="Go to next page"]');
  await sleep(1000);
  await nextPage?.scrollIntoView();
  await nextPage?.click();
  await waitHideLoading(page);
  await sleep(500);
  const result = await parseSearchResults(page);
  if (result && result.start <= searchResult.start) {
    throw new Error(
      `click next page err: current: ${result.start} <= prev:${searchResult.start}`
    );
  }
  logger.debug("click next page");
  return result;
}

async function tryClickLastPage(
  logger: winston.Logger,
  page: Page,
  searchResult: SearchResult
) {
  let retry = 3;
  while (retry > 0) {
    try {
      return await clickLastPage(logger, page, searchResult);
    } catch {
      retry--;
    }
  }
  logger.debug("try click last page not successfull ");
  return null;
}

async function clickLastPage(
  logger: winston.Logger,
  page: Page,
  searchResult: SearchResult
) {
  await page.waitForSelector(".paginator", { timeout: 10000 });
  const pageButtons = await page.$$(".paginator a");
  await sleep(1000);
  await pageButtons[pageButtons.length - 3].scrollIntoView();
  await pageButtons[pageButtons.length - 3]?.click();
  await waitHideLoading(page);
  await sleep(500);
  const result = await parseSearchResults(page);
  if (result && result.start <= searchResult.start) {
    throw new Error(
      `click last page err: current: ${result.start} <= prev:${searchResult.start}`
    );
  }
  logger.debug("click last page");
  return result;
}

const nextAndCrawl = async (
  logger: winston.Logger,
  page: Page,
  searchResult: any,
  pageCount: number,
  dataRange: string
) => {
  const startTime = new Date();
  if (pageCount > 1) {
    const _searchResult = await tryClickNextPage(logger, page, searchResult);
    if (!_searchResult) return null;
    searchResult = _searchResult;
  }
  const products = await getProducts(
    logger,
    page,
    dataRange.split("TO").map((d) => {
      const [year, month, day] = d.trim().split("-");
      return `${day}.${month}.${year}`;
    })
  );
  await tryCreateBulk(products);
  const dbcount = await countDate(dataRange);
  if (searchResult.end > dbcount) {
    await tryDeleteBulk(products);
    return null;
  }
  await tryUpdateCrawl(dataRange, dbcount, false);
  const endTime = new Date();
  logSearchResult(logger, searchResult, dbcount, startTime, endTime);
  return searchResult;
};

async function tryNextAndCrawl(
  logger: winston.Logger,
  page: Page,
  searchResult: any,
  pageCount: number,
  dataRange: string
) {
  try {
    return await nextAndCrawl(logger, page, searchResult, pageCount, dataRange);
  } catch {
    logger.debug("try next and crawl not successfull ");
    return null;
  }
}

const logSearchResult = (
  logger: winston.Logger,
  searchResult: any,
  done: number,
  startTime?: Date,
  endTime?: Date
) => {
  let seconds = 0;
  if (startTime && endTime) {
    seconds = Math.floor(endTime.getTime() / 1000 - startTime.getTime() / 1000);
  }
  const lMsg = `progress: ${done}/${searchResult.total} page: ${searchResult.start}/${searchResult.end} ${seconds}s`;
  logger.info(lMsg);
};

async function newPage(b: Browser, proxy: Proxy | null) {
  const page = await b.newPage();
  // do not forget to put "await" before async functions

  if (proxy) {
    await page.authenticate({
      // username: "1mdXkbAvM",
      // password: "CaIOGn",
      username: proxy.user,
      password: proxy.password,
    });
  }

  const customUserAgent =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
  await page.setUserAgent(customUserAgent);
  // Set screen size
  await page.setViewport({ width: 1920, height: 1080 });

  // Navigate the page to a URL
  await page.goto(
    `http://wipopublish.ipvietnam.gov.vn/wopublish-search/public/trademarks?query=*:*`,
    { timeout: 0 }
  );
  await page.waitForNetworkIdle(); // Wait for network resources to fully load
  return page;
}

async function searchWithBrowser(
  logger: winston.Logger,
  b: Browser,
  proxy: Proxy | null,
  dataRange: string,
  start: number
): Promise<[number, boolean, number]> {
  let pageCount = 0;
  let isEnd = false;
  let searchResult;
  try {
    const page = await newPage(b, proxy);
    const noDataFound = await typeAndSubmitSearch(page, dataRange);
    if (noDataFound) {
      logger.debug("nodata found: " + dataRange);
      return [0, true, 0];
    }

    searchResult = await navigateThroughPages(logger, page, start);
    if (!searchResult || searchResult.total == 0) {
      return [0, false, 0];
    }

    if (start >= searchResult.total) {
      return [start, true, searchResult.total];
    }
    runQueues[dataRange] = searchResult;
    logSearchResult(logger, searchResult, start);
    while (!isEnd) {
      pageCount++;
      const _searchResult = await tryNextAndCrawl(
        logger,
        page,
        searchResult,
        pageCount,
        dataRange
      );
      runQueues[dataRange] = searchResult;
      if (_searchResult) {
        isEnd = _searchResult.end == searchResult.total;
        searchResult = _searchResult;
      } else {
        break;
      }
    }
  } catch (e: any) {
    logger.debug(e.message);
  }
  if (searchResult) {
    return [searchResult.start, isEnd, searchResult.total];
  } else {
    return [0, false, 0];
  }
}

async function createBrowser(
  i: number,
  headless: boolean
): Promise<[Browser, Proxy | null]> {
  const proxy = getProxy(i);
  const args = [];
  if (proxy) {
    args.push(`--proxy-server=${proxy.server}`);
  }
  const browser = await puppeteer.launch({
    headless,
    ignoreDefaultArgs: ["--disable-extensions", "--enable-automation"],
    args: [
      ...args,
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
      "--allow-running-insecure-content",
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--mute-audio",
      "--no-zygote",
      "--no-xshm",
      "--window-size=1920,1080",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--enable-webgl",
      "--ignore-certificate-errors",
      "--lang=en-US,en;q=0.9",
      "--password-store=basic",
      "--disable-gpu-sandbox",
      "--disable-software-rasterizer",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-infobars",
      "--disable-breakpad",
      "--disable-canvas-aa",
      "--disable-2d-canvas-clip-aa",
      "--disable-gl-drawing-for-tests",
      "--enable-low-end-device-mode",
    ],
  });
  return [browser, proxy];
}

async function search(dateRange: string, headless: boolean, index: number) {
  let nextProductNumber = await countDate(dateRange);
  let isRunning = true;
  runQueues[dateRange] = {};
  while (isRunning) {
    try {
      const [browser, proxy] = await createBrowser(index, headless);
      const proxyServer = proxy ? proxy.server : "192.16.11.1:57432";
      const logger = createLogger(`range: ${dateRange} proxy:` + proxyServer);

      const [productNumber, isEnd, total] = await searchWithBrowser(
        logger,
        browser,
        proxy,
        dateRange,
        nextProductNumber
      );
      isRunning = !isEnd;
      nextProductNumber = productNumber ? productNumber : nextProductNumber;
      await browser.close();
      const dbCount = await countDate(dateRange);
      if (isEnd) {
        if (dbCount >= total) {
          await updateCrawl(dateRange, 0, isEnd);
        } else {
          nextProductNumber = 0;
          await resetCrawl(dateRange);
          isRunning = true;
          process.exit(1);
        }
      }
      const finished = !isRunning ? "finished" : "retrying";
      logger.info(
        `crawled: ${dbCount}/${total} (${finished}), next: ${nextProductNumber}`
      );
      delete runQueues[dateRange];
    } catch (e: any) {
      console.error(e.message);
    }
  }
}

export async function crawl() {
  const args = minimist(process.argv.slice(2));
  setLevel(args.debug ? "debug" : "info");
  if (args.daterange) {
    await createDateRange(args.daterange);
    console.log("created date range", args.daterange);
  }
  await loadProxy();
  const queues = await getQueue();
  maxQueue = args.limit || 1;
  console.log("queues:", queues.length);
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
