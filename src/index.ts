import * as dotenv from "dotenv";
dotenv.config();
import { runServer } from "./server";
import { crawl as wipoCrawl } from "./wipo";
import { createIndex } from "./elasticsearch";
import { runCrawl as wipoglobalCrawl } from "./wipo-global";
import { runCrawl as runGoogleTranslateCrawl } from "./translate";
import { runCrawl as runWipovnv2 } from "./wipovnv2";
import { runApp as runUpdateApp } from "./update";

function main() {
  runServer();
  const mode = process.env.MODE;
  if (mode == "wipo") {
    wipoCrawl();
  } else if (mode == "wipo-global") {
    wipoglobalCrawl();
  } else if (mode == "translae") {
    runGoogleTranslateCrawl();
  } else if (mode == "index") {
    createIndex();
  } else if (mode == "wipovnv2") {
    runWipovnv2();
  } else if (mode == "update") {
    runUpdateApp();
  }
}

main();
