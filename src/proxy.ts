import axios from "axios";

export interface Proxy {
    server: string;
    user: string;
    password: string;
  }

let _proxies: Array<Proxy | null> = [null];



export function getProxy(_: number) {
    return _proxies[Math.floor(Math.random() * _proxies.length)]
}

export async function loadProxy() {
    const res = await axios(process.env.PROXY_API as string)
    const proxies = convertStringToArray(res.data)
    _proxies = [null, ...proxies.map((p: { proxy: string; }) => parseProxyString(p.proxy))];
}
loadProxy();


function parseProxyString(proxyStr: string): Proxy {
    const [ip, port, user, password] = proxyStr.split(':');
    return {
        server: `${ip}:${port}`,
        user,
        password
    };
}

function convertStringToArray(str: string) {
    // Thêm dấu phẩy giữa các đối tượng để chúng ta có thể tạo một mảng
    let fixedStr = str.replace(/\}\{/g, '},{');
    
    // Bọc toàn bộ thành một mảng JSON hợp lệ
    fixedStr = `[${fixedStr}]`;
    
    // Chuyển đổi chuỗi JSON thành một mảng đối tượng
    let array = JSON.parse(fixedStr);
    
    return array;
}