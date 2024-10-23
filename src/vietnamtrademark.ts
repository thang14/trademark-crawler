
import puppeteer from "puppeteer-extra";
import Stealth from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

puppeteer.use(Stealth());


interface TrademarkData {
    soDon: string;           // Số đơn
    soDonChecksum: string;   // Checksum của số đơn
    stt: string;             // Số thứ tự
    nhanHieuImage: string;   // Đường dẫn ảnh nhãn hiệu
    nhanHieuAlt: string;     // Mô tả ảnh nhãn hiệu (alt)
    nhanHieuName: string;    // Tên nhãn hiệu
    niceClassification: string; // Nhóm phân loại Nice
    status: string;          // Trạng thái (VD: Cấp bằng)
    ngayNop: string;         // Ngày nộp đơn
    soDonLink: string;       // Liên kết tới chi tiết số đơn
    chuDon: string;          // Tên chủ đơn
    daiDien: string;         // Đại diện pháp lý
  }

  const delay = (ms: number | undefined) => new Promise(resolve => setTimeout(resolve, ms))
async function getDetails(id: string) {
  // http://wipopublish.ipvietnam.gov.vn/wopublish-search/public/detail/trademarks?id=VN4202347985
  // Launch the browser and open a new blank page
  const browser = await puppeteer.launch({ headless: true});
  const page = await browser.newPage();
  const cookiesString = fs.readFileSync('./cookies.json', 'utf8');
  if (cookiesString) {
    await page.setCookie(...JSON.parse(cookiesString));
  }

  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
  );

   // Navigate the page to a URL
   await page.goto(
    `http://wipopublish.ipvietnam.gov.vn/wopublish-search/public/detail/trademarks?id=${id}`
  );

  await page.waitForNetworkIdle(); // Wait for network resources to fully load

  await page.waitForSelector(".product-details")

  console.log(1212);

  const cookies = await page.cookies();
  fs.writeFileSync('./cookies.json', JSON.stringify(cookies, null, 2));
  await browser.close();
}

//getDetails("VN4202328557")

async function search(q: string, nices: string[]): Promise<TrademarkData[]> {
  // Launch the browser and open a new blank page
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const customUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.82 Safari/537.36';
  await page.setUserAgent(customUserAgent);

  // Navigate the page to a URL
  await page.goto(
    `https://vietnamtrademark.net/search?q=${q}&g=${nices.join(',')}`
  );

  // Set screen size
  await page.setViewport({ width: 1080, height: 1024 });

  // Chờ bảng tải
  await page.waitForSelector('.text-count-result');

  // Bóc tách dữ liệu
  const data = await page.evaluate(() => {
    const rows = document.querySelectorAll('tr');
    const result: TrademarkData[] = [];

    rows.forEach((row) => {
      const soDon = row.getAttribute('data-so-don') || ''; // Lấy số đơn
      const soDonChecksum = row.getAttribute('data-so-don-checksum') || ''; // Lấy checksum
      const stt = row.querySelector('td:nth-child(2)')?.textContent?.trim() || ''; // Lấy STT
      const nhanHieuImage = row.querySelector('td:nth-child(3) img')?.getAttribute('src') || ''; // Hình ảnh nhãn hiệu
      const nhanHieuAlt = row.querySelector('td:nth-child(3) img')?.getAttribute('alt') || ''; // Mô tả nhãn hiệu
      const nhanHieuName = row.querySelector('td:nth-child(4) label')?.textContent?.trim() || ''; // Tên nhãn hiệu
      const niceClassification = row.querySelector('td:nth-child(5) div')?.textContent?.trim() || ''; // Nhóm Nice
      const status = row.querySelector('td:nth-child(6) span')?.textContent?.trim() || ''; // Trạng thái
      const ngayNop = row.querySelector('td:nth-child(7)')?.textContent?.trim() || ''; // Ngày nộp
      const soDonLink = row.querySelector('td:nth-child(8) a')?.getAttribute("href") || ''; // Link số đơn
      const chuDon = row.querySelector('td:nth-child(9)')?.textContent?.trim() || ''; // Chủ đơn
      const daiDien = row.querySelector('td:nth-child(10)')?.textContent?.trim() || ''; // Đại diện

      result.push({
        soDon,
        soDonChecksum,
        stt,
        nhanHieuImage,
        nhanHieuAlt,
        nhanHieuName,
        niceClassification,
        status,
        ngayNop,
        soDonLink,
        chuDon,
        daiDien,
      });
    });

    return result;
  });

  await browser.close();
  return data as any;
}

interface LookupTrademark {
  nice_codes: string[];
  trademark_name: string;
  similar_names: string[];
}

export async function lookupTrademark(params: LookupTrademark) {
  let trademarks =  await search(params.trademark_name, params.nice_codes)
  return trademarks.slice(0,5);
}

function objectsToMarkdown(trademarks: TrademarkData[]) {
    let markdown = '';

    // Thêm tiêu đề cho bảng
    const headers = ['Số Đơn', 'Nhãn Hiệu', 'Phân Loại Nice', 'Ngày Nộp', 'Tình Trạng', 'Chủ Đơn', 'Đại Diện'];
    const headerRow = headers.map(header => `| ${header} `).join('') + '|\n';
    const separatorRow = headers.map(() => '|---').join('') + '|\n';
    
    markdown += headerRow + separatorRow;

    // Duyệt qua từng nhãn hiệu trong danh sách
    trademarks.forEach((trademark: TrademarkData) => {
        markdown += `| ${trademark.soDon} | ${trademark.nhanHieuName} | ${trademark.niceClassification} | ${trademark.ngayNop} | ${trademark.status} | ${trademark.chuDon} | ${trademark.daiDien} |\n`;
    });

    return markdown;
}


export function buildTrademarkMessage(trademarks: TrademarkData[]) : any {
    let markdown =  trademarks.length > 0 ? objectsToMarkdown(trademarks) :  "hiện chưa có ai đăng ký";
    return {
        role: "user",
        content: [
            {
                type: "text",
                text: `
                    không phải tra cứu nhãn hiệu mà hãy phân tích.
                    Dưới đây là danh sách các nhãn hiệu đã đăng ký:
                    ${markdown}
                    Vui lòng phân tích mức độ tương đồng và khả năng đăng ký nhãn hiệu của tôi so với các nhãn đã được đăng ký này.
                `
            }
        ]
    }
}



// (async () => {
//     console.log(buildTrademarkMessage(await lookupTrademark({
//         nice_codes: ['35'],
//         trademark_name: "fizida",
//         similar_names: []
//     })))
// })()
