import { Browser, Page } from "puppeteer";
import { createBrowser, newPage, sleep } from "./wipo";
import { Proxy } from "./proxy";

const PAGEURL = "https://www3.wipo.int/madrid/monitor/en/";

class AppBrowser {
  browser: Browser;
  page: Page | undefined;
  proxy: Proxy | null;
  startPage: number;

  constructor(browser: Browser, proxy: Proxy | null, startPage: number) {
    this.browser = browser;
    this.proxy = proxy;
    this.startPage = startPage;
  }

  async search() {
    this.page = await newPage(this.browser, this.proxy, PAGEURL);
    await this.page.waitForSelector("#advancedModeLink");
    await this.page.click("#advancedModeLink");
    await this.page.waitForSelector("#DS_input");
    await this.page.type("#DS_input", "VN");
    await sleep(1000);
    await this.page.click("a.searchButton");
    await this.page.waitForSelector("#gridForsearch_pane");
    await this.page.waitForSelector("#skipValue0");
    await sleep(1000);
    await this.page.click("#skipValue0");
    await this.page.keyboard.press("Backspace");
    await this.page.type("#skipValue0", this.startPage.toString());
    await sleep(1000);
    await this.page.keyboard.press("Enter");
    await sleep(1000);

    const rows = await this.page.$$(
      `#gridForsearch_pane tbody tr.ui-widget-content`
    );
    await sleep(1000);
    await rows[0].click();
    await this.page.waitForSelector("#documentContent");
    await sleep(2000);

    while (true) {
      const item = await this.parseItem();
      console.log(JSON.stringify(item, null, 2));
      await sleep(1000);
      await this.page.click("#topDocNext");
      await sleep(1000);
      await this.page.waitForSelector("#documentContent");
      await sleep(1000);
      await this.page.click("#expandAll");
      await sleep(1000);
      await this.page.click("#designationStatusTab")
      await sleep(1000);
    }
  }

  async parseItem() {
    return this.page!.evaluate(() => {
      const nameid = document
        .querySelector("td.markname h3")
        ?.textContent?.trim();
      const [id, ...nameParts] = nameid!.split("-").map((part) => part.trim());
      const trademarkName = nameParts.join("-");

      const fragmentDetail = document.querySelector(".fragment-detail")
      // Lấy tên và địa chỉ của người giữ bản quyền
      const holderName =
        document
          .querySelector('.p[tag="HOLGR"] .holType')
          ?.textContent!.trim() || "";
      const holderAddress =
        Array.from(document.querySelectorAll('.p[tag="HOLGR"] .text div'))
          .map((el) => el.textContent!.trim())
          .filter((text) => text.length > 0)
          .join(", ") || "";

      // Lấy quốc gia của người giữ bản quyền
      const holderCountry =
        document
          .querySelector('.p[tag="ENTNATL"] .text span')
          ?.textContent!.trim() || "";

      // Lấy tính pháp lý của người giữ bản quyền
      const legalNature =
        document
          .querySelector('.p[tag="LEGNATT"] .text')
          ?.textContent!.trim() || "";

      // Lấy tên và địa chỉ của đại diện
      const representativeName =
        document
          .querySelector('.p[tag="REPGR"] .repType')
          ?.textContent!.trim() || "";
      const representativeAddress =
        Array.from(document.querySelectorAll('.p[tag="REPGR"] .text div'))
          .map((el) => el.textContent!.trim())
          .filter((text) => text.length > 0)
          .join(", ") || "";

      // Thông tin đăng ký cơ bản
      const basicRegistration =
        document
          .querySelector('.p[tag="BASREGGR"] .text')
          ?.textContent!.trim() || "";

      // Thông tin các quốc gia chỉ định theo Nghị định thư Madrid
      const madridDesignations =
        Array.from(
          document.querySelectorAll('.p[tag="DESPG"] .text.designations span')
        )
          .map((el) => el.textContent!.trim())
          .join(", ") || "";

      const trademarkImage = document
        .querySelector(".mark img")
        ?.getAttribute("src");
      const holder = document
        .querySelector(".name .lapin.client.holType")
        ?.textContent!.trim();
      const niceCode = document
        .querySelector("#countryStatus-VN .headerClasses")
        ?.textContent!.trim();

      const country =
        document.querySelector("#countryStatus-VN .country-name")?.textContent || "";
      const status =
        document.querySelector("#countryStatus-VN  .protection-status")?.textContent || "";
      const classificationCode =
        document.querySelector("#countryStatus-VN  .classification-code")?.textContent || "";
      const grantDate =
        document.querySelector("#countryStatus-VN  .grant-date")?.textContent || "";

      // Tách chi tiết sản phẩm
      const productDetails = Array.from(
        document.querySelectorAll("#countryStatus-VN  .classList")
      ).map((el) => el.textContent);

      // Tách lịch sử giao dịch
      const transactionHistory = Array.from(
        document.querySelectorAll("#fragment-history div.p")
      ).map((el) => ({
        inidCode: el.querySelector(".inidCode")?.textContent?.trim() || "",
        inidText: el.querySelector(".inidText")?.textContent?.trim() || "",
        text: el.querySelector(".text")?.textContent?.trim() || "",
      }));

      // Tách thông tin bổ sung
      const registrationDate =
        document.querySelector(".registration-date")?.textContent || "";
      const expirationDate =
        document.querySelector(".expiration-date")?.textContent || "";
      const applicationLanguage =
        document.querySelector(`div[tag="ORIGLAN"]`)?.textContent || "";
      const internationalOfficeReceiptDate =
        document.querySelector(".international-office-receipt-date")
          ?.textContent || "";

      // Trả về tất cả dữ liệu dưới dạng đối tượng
      return {
        id,
        country,
        status,
        classificationCode,
        grantDate,
        productDetails,
        transactionHistory,
        registrationDate,
        expirationDate,
        applicationLanguage,
        internationalOfficeReceiptDate,
        trademarkImage,
        holder,
        niceCode,
        madridDesignations,
        representativeAddress,
        basicRegistration,
        representativeName,
        holderCountry,
        holderAddress,
        legalNature,
        trademarkName,
        holderName,
        nameid,
      };
    });
  }
}

async function newBrowserSearch(index: number, headless: boolean) {
  const [browser, proxy] = await createBrowser(index, headless);
  const appBrowser = new AppBrowser(browser, proxy, 1);
  return appBrowser.search();
}

export async function runCrawl() {
  await newBrowserSearch(0, false);
}
