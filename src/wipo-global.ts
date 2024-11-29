import { Browser, Page } from "puppeteer";
import { createBrowser, newPage, sleep } from "./wipo";
import { loadProxy, Proxy } from "./proxy";
import minimist from "minimist";
import { createLogger, setLevel } from "./logger";
import {
  createPages,
  finalPage,
  getPage,
  getPages,
  incPageItemCount,
} from "./leveldb";
import pLimit from "p-limit";
import { TrademarkGlobal } from "./interface";
import { createBulkGlobal } from "./elasticsearch";
import { Logger } from "winston";

const statusMap: { [key: string]: string } = {
  "No longer in effect": "Hết hạn",
  "Protection granted": "Cấp bằng",
  "Provisionally refused": "Từ chối",
  "Awaiting decision": "Đang giải quyết",
};

const PAGEURL = "https://www3.wipo.int/madrid/monitor/en/";
const ROW_PER_PAGE = 100;

class AppBrowser {
  browser: Browser;
  page: Page | undefined;
  proxy: Proxy | null;
  startPage: number;
  max: number;

  constructor(
    private logger: Logger,
    browser: Browser,
    proxy: Proxy | null,
    private jobId: number,
    startPage: number,
    private nextRow: number,
    max: number
  ) {
    this.browser = browser;
    this.proxy = proxy;
    this.startPage = startPage;
    this.max = max;
  }

  async extractPagerData() {
    const text = await this.page!.evaluate(() => {
      return document
        .querySelector(".pagerPos")
        ?.textContent?.trim()
        .replace(/,/g, "");
    });

    const regex = /(\d+)\s*-\s*(\d+)\s*\/\s*(\d+)/;
    const match = text!.match(regex);

    if (match) {
      const start = parseInt(match[1], 10);
      const end = parseInt(match[2], 10);
      const total = parseInt(match[3], 10);

      return { start, end, total };
    }

    return null;
  }

  async search() {
    this.page = await newPage(this.browser, this.proxy, PAGEURL);
    await this.page.waitForSelector("#advancedModeLink");
    await this.page.click("#advancedModeLink");
    await sleep(1000);
    await this.page.waitForSelector("#DS_input");
    await this.page.type("#DS_input", "VN");
    await sleep(1000);
    await this.page.click("a.searchButton");
    await this.page.waitForSelector("#gridForsearch_pane");
    await this.page.waitForSelector("#skipValue0");
    await sleep(1000);
    await this.page.select("#rowCount1", "100");
    await sleep(1000);
    await this.page.click("#skipValue0", { count: 3 });
    await sleep(1000);
    await this.page.type("#skipValue0", this.startPage.toString());
    await sleep(1000);
    await this.page.keyboard.press("Enter");
    await this.page.waitForSelector(".scrolling", { hidden: true });
    await this.page.waitForSelector(
      "#gridForsearch_pane tbody tr.ui-widget-content"
    );
    await sleep(10000);

    const pageInfo = await this.extractPagerData();
    if (pageInfo?.start != (this.startPage - 1) * ROW_PER_PAGE + 1) {
      this.logger.error("parse page data error");
      return null;
    }

    const rows = await this.page.$$(
      `#gridForsearch_pane tbody tr.ui-widget-content`
    );
    let isFirst = true;
    let doneCount = this.nextRow;
    while (true) {
      await sleep(1000);
      if (!isFirst) {
        await this.page.click("#topDocNext");
      } else {
        await rows[this.nextRow].click();
        isFirst = false;
      }
      await this.page.waitForSelector("#documentContent");
      await sleep(500);
      try {
        await this.page.click("#designationStatusTab");
        await sleep(200);
        await this.page.waitForSelector("#countryStatus-VN", { timeout: 1000 });
        await this.page.click("#countryStatus-VN .toggle");
        await sleep(200);
        const toogle = await this.page.$$(
          "#countryStatus-VN .transactions .toggle"
        );
        for (let t of toogle) {
          await t.click();
        }
        await sleep(300);
      } catch {}

      const item = await this.parseItem();
      if (item && item.id) {
        await createBulkGlobal([item]);
      }
      const totalSaved = await incPageItemCount(this.jobId);
      doneCount++;
      this.logger.debug(
        `progress: ${totalSaved}/${this.max} id: ${
          item ? item.id : ""
        }, ${doneCount}/${ROW_PER_PAGE}`
      );
      if (totalSaved >= this.max) {
        await finalPage(this.jobId);
        return;
      }
      if (doneCount == ROW_PER_PAGE) {
        return;
      }
    }
  }

  async parseId(): Promise<string> {
    return this.page!.evaluate(() => {
      const nameid = document
        .querySelector("td.markname h3")
        ?.textContent?.trim();
      const [id] = nameid!.split("-").map((part) => part.trim());
      return id;
    });
  }

  async parseItem(): Promise<TrademarkGlobal | null> {
    return this.page!.evaluate((statusMap) => {
      const nameid = document
        .querySelector("td.markname h3")
        ?.textContent?.trim();
      const [id, ...nameParts] = nameid!.split("-").map((part) => part.trim());
      const trademarkName = nameParts.join("-");

      const vnE = document.querySelector("#countryStatus-VN");
      if (!vnE) {
        return null;
      }
      const fragmentDetail = document.querySelector("#fragment-detail");

      const markInfoHeaderTd = document.querySelectorAll(
        "#markInformationHeader td"
      );

      const status = vnE!
        .querySelector(".protectionStatus")
        ?.textContent?.trim();
      // Lấy tên và địa chỉ của người giữ bản quyền

      const holderE = fragmentDetail!.querySelectorAll(
        '.p[tag="HOLGR"] .text div'
      );
      const holder = {
        name: holderE[0].textContent!.trim() || "",
        address: Array.from(holderE)
          .slice(1, 20)
          .map((e) => e.textContent?.trim())
          .join(", ")
          .replace(/\n/g, "")
          .replace(/\t/g, "")
          .replace(/\s+/g, " "),
      };

      const source = fragmentDetail!
        .querySelector('div[tag="ENTNATL"] .text span')
        ?.textContent?.trim();

      const representativeE = fragmentDetail!.querySelectorAll(
        '.p[tag="REPGR"] .text div'
      );

      let represent = undefined;
      if (representativeE.length > 2) {
        // Lấy tên và địa chỉ của đại diện
        represent = {
          name: representativeE[0].textContent!.trim() || "",
          address: Array.from(representativeE)
            .slice(1, 10)
            .map((e) => e.textContent?.trim())
            .join("")
            .replace(/\n/g, "")
            .replace(/\t/g, "")
            .replace(/\s+/g, " "),
        };
      }

      // Thông tin đăng ký cơ bản
      const basicRegistration =
        fragmentDetail!
          .querySelector('.p[tag="BASREGGR"] .text span')
          ?.textContent!.trim() || "";

      // Tách chi tiết sản phẩm
      const classesDes = vnE!.querySelectorAll("dl.classList dd");
      const classes = Array.from(vnE!.querySelectorAll("dl.classList dt")).map(
        (el, i) => {
          const p = classesDes[i].querySelector("p");
          return {
            code: el.textContent?.trim(),
            description: p?.textContent?.trim().replace(/\n/g, ""),
          };
        }
      );

      const exclude = fragmentDetail!
        .querySelector('div[tag="DISCLAIMGR"] .text')
        ?.textContent?.trim();

      // Tách lịch sử giao dịch
      const txs = Array.from(
        vnE!.querySelectorAll(".transactions .transaction")
      ).map((el) => {
        return {
          date: el
            .querySelector(".transactionListDate")
            ?.textContent?.trim()
            .replace(/\n/g, "")
            .replace(/\t/g, "")
            .replace(/\s+/g, " ")
            .replace(": ", ""),
          text: el
            .querySelector(".transactionListTransaction")
            ?.textContent?.trim()
            .replace(/\n/g, "")
            .replace(/\t/g, "")
            .replace(/\s+/g, " "),
          description: Array.from(el.querySelectorAll(".description > .p")).map(
            (el2) => {
              const inidCode =
                el2.querySelector(".inidCode")?.textContent?.trim() || "";
              return {
                inidCode,
                text:
                  inidCode != ""
                    ? el2
                        .querySelector(".text")
                        ?.textContent?.trim()
                        .replace(/\n/g, "")
                        .replace(/\s+/g, " ") || ""
                    : "",
              };
            }
          ).filter(d => d.inidCode != ""),
        };
      });

      // Tách thông tin bổ sung
      const registrationDate = markInfoHeaderTd[2].textContent?.trim();
      const expirationDate = markInfoHeaderTd[3].textContent?.trim();
      const logo =
        markInfoHeaderTd[0].querySelector("img")?.getAttribute("src") || "";
      const applicationLanguage =
        fragmentDetail?.querySelector(`div[tag="ORIGLAN"] .text`)
          ?.textContent?.trim() || "";

      const classOfShapes = Array.from(
        fragmentDetail!.querySelectorAll('div[tag="VIENNAGR"] .text .hasTip')
      ).map((e) => {
        return {
          code: e.textContent?.trim() || "",
          number: 0,
          tip: e.getAttribute("aria-label"),
        };
      });

      const colors = Array.from(
        fragmentDetail!.querySelectorAll('div[tag="COLCLAEN"] .firstLanguage')
      ).map((t) => t.textContent?.trim() || "");

      const indication = fragmentDetail?.querySelector('div[tag="VRBLNOT"] .text')
        ?.textContent?.trim();

      // Trả về tất cả dữ liệu dưới dạng đối tượng
      return {
        id,
        logo: logo
          ? "https://www3.wipo.int/madrid/monitor/" + logo.replace("../", "")
          : undefined,
        source: source || basicRegistration,
        name: trademarkName,
        colors,
        exclude,
        destination: "VN",
        status: statusMap[status ? status : ""] || "Chưa rõ",
        registrationDate,
        expirationDate,
        applicationLanguage,
        indication,
        holder,
        represent,
        classOfShapes,
        classes,
        txs,
      };
    }, statusMap);
  }
}

async function newBrowserSearch(
  jobId: number,
  max: number,
  index: number,
  headless: boolean
) {
  while (true) {
    await sleep(1000);
    const page = await getPage(jobId);
    if (page.itemsCount >= max) {
      return;
    }
    const [browser, proxy] = await createBrowser(index, headless);
    const proxyServer = proxy ? proxy.server : "192.16.11.1:57432";
    const logger = createLogger("job:" + jobId + " | proxy: " + proxyServer);
    try {
      const itemCount = (jobId - 1) * max;
      const startPage = Math.round(itemCount / ROW_PER_PAGE) || 1;
      const nextPage = startPage + Math.floor(page.itemsCount / ROW_PER_PAGE);
      const nextRow = page.itemsCount - (nextPage - startPage) * ROW_PER_PAGE;
      logger.info(
        `progress: ${page.itemsCount}/${max} page: ${nextPage} row: ${nextRow}/${ROW_PER_PAGE}`
      );
      const appBrowser = new AppBrowser(
        logger,
        browser,
        proxy,
        jobId,
        nextPage,
        nextRow,
        max
      );
      await appBrowser.search();
    } catch (err: any) {
      logger.debug(err.message);
    } finally {
      await browser.close();
    }
  }
}

export async function runCrawl() {
  const args = minimist(process.argv.slice(2));
  setLevel(args.debug ? "debug" : "info");
  const maxQueue = args.limit || 1;

  if (args.create) {
    await createPages(maxQueue);
  }

  const total = args.total || 170217;
  const max = Math.round(Number(total) / Number(maxQueue));

  const queues = await getPages();
  await loadProxy();
  console.log("queues:", queues.length);
  const limit = pLimit(maxQueue);
  const promises: any[] = [];
  for (let i = 0; i < queues.length; i++) {
    promises.push(
      limit(() =>
        newBrowserSearch(
          Number(queues[i].key),
          max,
          i,
          args.open ? false : true
        )
      )
    ); // Gọi hàm search với ngày hiện tại
  }

  try {
    await Promise.all(promises);
    console.log("Hoàn tất tất cả tiến trình.");
  } catch (err) {
    console.error("Lỗi:", err);
  }
}
