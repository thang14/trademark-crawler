import express from "express";
import bodyParser from "body-parser";
import { runQueues } from "./wipo";

const port = process.env.PORT || 3000;

export const runServer = () => {
  const app = express();

  // parse application/x-www-form-urlencoded
  app.use(bodyParser.urlencoded({ extended: false }));

  // parse application/json
  app.use(bodyParser.json());
  
  app.get("/progress", (_, res) => {
    res.json(runQueues);
  })

  function errorHandler(
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    if (res.headersSent) {
      return next(err);
    }
    res.status(500);
    res.render("error", { error: err });
  }

  app.use(errorHandler);

  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });
};