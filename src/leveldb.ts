import { Level } from "level";
export const DB_PATH = process.env.DB_PATH || "./db";

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

function key(dateRange: string) {
  return "daterange:" + dateRange;
}

export async function getQueue() {
  const queues = [];
  for await (const [key, value] of db.iterator({
    gte: "daterange:",
    lt: "daterange:" + "\uffff", // '\uffff' ensures we get all possible keys with the prefix
  })) {
    if (!value.crawled) {
      queues.push({
        key: key.replace("daterange:", ""),
        value: value,
      });
    }
  }
  return queues;
}

export async function updateCrawl(dateRange: string, itemsCount: number) {
  await db.put(key(dateRange), {
    itemsCount: itemsCount,
    crawled: true,
  });
}
