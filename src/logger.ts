import { createLogger as baseCreateLogger, format, transports } from "winston";
const { combine, timestamp, colorize, printf } = format;

let level = "info";

export function setLevel(param: string) {
  level = param;
}

export function createLogger(prefix: string) {
  const customFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} ${prefix} [${level}]: ${message}`;
  });

  return baseCreateLogger({
    level: level,
    format: combine(
      timestamp(), // Thêm timestamp vào log
      colorize(), // Màu sắc cho console
      customFormat // Sử dụng định dạng tùy chỉnh
    ),
    transports: [new transports.Console()],
  });
}
