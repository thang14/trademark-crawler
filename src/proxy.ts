import axios from "axios";
import { HttpProxyAgent } from "http-proxy-agent";

export interface Proxy {
  server: string;
  user: string;
  password: string;
}

let _proxies: Array<Proxy | null> = [null];

export function proxyCount(): number {
  return _proxies.length;
}

export function getProxy(_: number) {
  return _proxies[Math.floor(Math.random() * _proxies.length)];
}

export async function loadProxy() {
  let proxyList = process.env.PROXY_LIST
    ? Buffer.from(process.env.PROXY_LIST, "base64").toString()
    : null;


    if (!proxyList) {
        const res = await axios(process.env.PROXY_API as string, {
            httpAgent: process.env.PROXY
              ? new HttpProxyAgent(process.env.PROXY)
              : undefined,
          });
        proxyList = res.data;
    }


  const proxies = convertStringToArray(proxyList!);
  _proxies = [
    null,
    ...proxies.map((p: { proxy: string }) => parseProxyString(p.proxy)),
  ];
}
loadProxy();

function parseProxyString(proxyStr: string): Proxy {
  const [ip, port, user, password] = proxyStr.split(":");
  return {
    server: `${ip}:${port}`,
    user,
    password,
  };
}

function convertStringToArray(str: string) {
  // Thêm dấu phẩy giữa các đối tượng để chúng ta có thể tạo một mảng
  let fixedStr = str.replace(/\}\{/g, "},{");

  // Bọc toàn bộ thành một mảng JSON hợp lệ
  fixedStr = `[${fixedStr}]`;

  // Chuyển đổi chuỗi JSON thành một mảng đối tượng
  let array = JSON.parse(fixedStr);

  return array;
}
