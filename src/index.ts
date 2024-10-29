import * as dotenv from "dotenv";
dotenv.config();
import { runServer } from "./server";
import { crawl} from "./wipo";


function main() {
  runServer()
  crawl()
}

main();