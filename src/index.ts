import * as dotenv from "dotenv";
dotenv.config();
import { runServer } from "./server";
import { crawl} from "./wipo";
import { createIndex } from "./elasticsearch";
import { runCrawl } from "./wipo-global";


function main() {
  //createIndex()
  // runServer()
  // crawl()
  runCrawl();
}

main();