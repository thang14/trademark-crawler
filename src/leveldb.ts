import { Level } from "level";
import { getDateRangeBy } from "./elasticsearch";
import minimist from "minimist";
import { page } from "pdfkit";

const args = minimist(process.argv.slice(2));

export const DB_PATH = args.db || "./db";
const pageKeyPrefix = "page:";

// Initialize the LevelDB instance with string keys and any type of values.
// The data is stored in the "./db/data" directory, and values are encoded/decoded as JSON.
const db = new Level<string, any>(DB_PATH + "/data", { valueEncoding: "json" });

export async function createDateRange(daterange: string) {
  const dateRange = daterange.split(",");
  const startDate = new Date(dateRange[0]);
  const endDate = new Date(dateRange[1]);

  const totalDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  ); // Tính số ngày trong khoảng thời gian
  const batch: any[] = [];
  for (let i = 0; i <= totalDays; i += 2) {
    const currentStartDate = new Date(startDate);
    currentStartDate.setDate(currentStartDate.getDate() + i); // Tính ngày bắt đầu cho khoảng 7 ngày

    const currentEndDate = new Date(currentStartDate);
    currentEndDate.setDate(currentStartDate.getDate() + 1); // Tính ngày kết thúc cho khoảng 7 ngày

    // Đảm bảo ngày kết thúc không vượt quá ngày kết thúc tổng
    if (currentEndDate > endDate) {
      currentEndDate.setTime(endDate.getTime());
    }

    // Tạo chuỗi daterange cho khoảng 7 ngày
    const daterange = `${currentStartDate.toISOString().split("T")[0]} TO ${
      currentEndDate.toISOString().split("T")[0]
    }`;

    batch.push({
      type: "put",
      key: key(daterange),
      value: {
        itemsCount: 0,
        crawled: false,
      },
    });
  }
  await db.batch(batch);
}

export async function createDateEveryday() {
  function formatDateRange(): string {
    const today = new Date(); // Ngày hôm nay
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1); // Tăng ngày thêm 1

    // Hàm chuẩn hóa ngày thành định dạng YYYY-MM-DD
    const format = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(date.getDate()).padStart(2, "0")}`;

    // Ghép thành chuỗi khoảng thời gian
    return `${format(yesterday)} TO ${format(today)}`;
  }
  await db.put(key(formatDateRange()), {
    itemsCount: 0,
    crawled: false,
  });
}

function key(dateRange: string) {
  return `daterange_${getDateRangeBy()}:${dateRange}`;
}

function pageKey(page: number) {
  return `${pageKeyPrefix}${page}`;
}

export async function getQueue() {
  const queues = [];
  for await (const [dbkey, value] of db.iterator({
    gte: key(""),
    lt: key("") + "\uffff", // '\uffff' ensures we get all possible keys with the prefix
  })) {
    if (!value.crawled) {
      queues.push({
        key: dbkey.replace(key(""), ""),
        value: value,
      });
    }
  }
  return queues;
}

export async function getCrawledItemsCount(dateRange: string) {
  const c = await getCrawl(dateRange);
  return c.itemsCount;
}

export async function updateCrawl(
  dateRange: string,
  itemsCount: number,
  crawled: boolean
) {
  await db.put(key(dateRange), {
    itemsCount: itemsCount,
    crawled: crawled,
  });
}

export async function incItemCount(dateRange: string) {
  const crawl = await getCrawl(dateRange);
  await db.put(key(dateRange), {
    itemsCount: crawl.itemsCount + 1,
    crawled: crawl.crawled,
  });
  return crawl.itemsCount + 1;
}

export async function resetCrawl(dateRange: string) {
  await db.put(key(dateRange), {
    itemsCount: 0,
    crawled: false,
  });
}

export async function tryUpdateCrawl(
  dateRange: string,
  itemsCount: number,
  crawled: boolean
) {
  let retry = 3;
  while (retry > 0) {
    try {
      return await updateCrawl(dateRange, itemsCount, crawled);
    } catch (e) {
      console.error(e);
      retry--;
    }
  }
}

export async function getCrawl(dateRange: string) {
  return db.get(key(dateRange));
}

export async function getPage(page: number) {
  return db.get(pageKey(page));
}

export async function createPages(num: number) {
  const batch: any[] = [];
  for (let i = 0; i < num; i++) {
    batch.push({
      type: "put",
      key: pageKey(i + 1),
      value: {
        itemsCount: 0,
        crawled: false,
      },
    });
  }
  await db.batch(batch);
}

export async function getPages() {
  const queues = [];
  for await (const [dbkey, value] of db.iterator({
    gte: pageKeyPrefix,
    lt: pageKeyPrefix + "\uffff", // '\uffff' ensures we get all possible keys with the prefix
  })) {
    if (!value.crawled) {
      queues.push({
        key: dbkey.replace(pageKeyPrefix, ""),
        value: value,
      });
    }
  }
  return queues;
}

export async function incPageItemCount(pageNumber: number) {
  const page = await getPage(pageNumber);
  await db.put(pageKey(pageNumber), {
    itemsCount: page.itemsCount + 1,
    crawled: page.crawled,
  });
  return page.itemsCount + 1;
}

export async function finalPage(pageNumber: number) {
  const page = await getPage(pageNumber);
  await db.put(pageKey(pageNumber), {
    itemsCount: page.itemsCount,
    crawled: true,
  });
}
