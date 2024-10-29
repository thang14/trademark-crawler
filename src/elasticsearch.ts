import { Client } from "@elastic/elasticsearch";
import { TrademarkInfo } from "./interface";
import md5 from "md5";
import { SearchTotalHits } from "@elastic/elasticsearch/lib/api/types";
const client = new Client({
  node: process.env.ELASTICSEARCH_HOST,
});

export async function createIndex() {
  // await client.indices.delete({ index: "represents" });
  // await client.indices.delete({ index: "owners" });
  // await client.indices.delete({ index: "trademarks" });

  await client.indices.create({
    index: "represents",
    mappings: {
      properties: {
        id: {
          type: "keyword",
        },
        name: {
          type: "text",
        },
        address: {
          type: "text",
        },
      },
    },
  });

  await client.indices.create({
    index: "owners",
    mappings: {
      properties: {
        id: {
          type: "keyword",
        },
        name: {
          type: "text",
        },
        address: {
          type: "text",
        },
      },
    },
  });

  await client.indices.create({
    index: "trademarks",
    settings: {
      similarity: {
        similarity: {
          type: "DFR",
          basic_model: "g",
          after_effect: "l",
          normalization: "h2",
        },
      },
      analysis: {
        analyzer: {
          tokenizer: {
            tokenizer: "tokenizer",
            type: "custom",
            filter: ["lowercase"]
          },
        },
        tokenizer: {
          tokenizer: {
            type: "ngram",
            min_gram: 3,
            max_gram: 3,
            token_chars: ["letter", "digit"],
          },
        },
      },
    },
    mappings: {
      properties: {
        name: {
          type: "text",
          similarity: "similarity",
          analyzer: "tokenizer",
        },
        logo: {
          type: "keyword",
        },
        application_number: {
          type: "keyword",
        },
        application_date: {
          type: "date",
        },
        application_type: {
          type: "keyword",
        },
        colors: {
          type: "keyword",
        },
        publication_number: {
          type: "keyword",
        },
        publication_date: {
          type: "date",
        },
        application_owner_id: {
          type: "keyword",
        },
        expired_date: {
          type: "date",
        },
        nices: {
          type: "nested",
          properties: {
            code: {
              type: "keyword",
            },
            description: {
              type: "keyword",
            },
          },
        },
        certificate_number: {
          type: "keyword",
        },
        certificate_date: {
          type: "keyword",
        },
        status: {
          type: "keyword",
        },
        classification_of_shapes: {
          type: "nested",
          properties: {
            code: {
              type: "keyword",
            },
            number: {
              type: "keyword",
            },
          },
        },
        represent_id: {
          type: "keyword",
        },
        exclude: {
          type: "text",
        },
        template: {
          type: "keyword",
        },
        translation: {
          type: "keyword",
        },
      },
    },
  });
  console.log("create index scueess");
}

function createDocument(trademark: TrademarkInfo) {
  const ownerId = md5(trademark.applicant.name + trademark.applicant.address);
  const dataset = [];
  dataset.push({ index: { _index: "owners", _id: ownerId } });
  dataset.push({
    name: trademark.applicant.name,
    address: trademark.applicant.address,
  });

  let representId = null;
  if (trademark.ipRepresentative) {
    representId = md5(
      trademark.ipRepresentative.name + trademark.ipRepresentative.address
    );
    dataset.push({ index: { _index: "represents", _id: representId } });
    dataset.push({
      name: trademark.ipRepresentative.name,
      address: trademark.ipRepresentative.address,
    });
  }

  dataset.push({
    index: { _index: "trademarks", _id: trademark.applicationNumber },
  });
  dataset.push({
    name: trademark.name,
    logo: trademark.logo,
    application_number: trademark.applicationNumber,
    application_date: parseDate(trademark.applicationDate),
    application_type: trademark.applicationType || null,
    colors: trademark.color
      ? trademark.color.split(",").map((c) => c.trim().replace(".", ""))
      : null,
    publication_number: trademark.publicationNumber,
    publication_date: parseDate(trademark.publicationDate),
    application_owner_id: ownerId,
    expired_date: parseDate(trademark.expiredDate),
    nices: trademark.nices,
    certificate_number: trademark.certificateNumber || null,
    certificate_date: parseDate(trademark.certificateDate),
    status: trademark.status,
    classification_of_shapes: trademark.classificationOfShapes.filter(
      (c) => !!c.code
    ),
    represent_id: representId || null,
    exclude: trademark.exclude || null,
    template: trademark.template || null,
    translation: trademark.translation || null,
  });
  return dataset;
}

export async function createBulk(trademarks: TrademarkInfo[]) {
  let dataset: any[] = [];
  for (let trademark of trademarks) {
    dataset = dataset.concat(createDocument(trademark));
  }
  const bulkResponse = await client.bulk({
    refresh: true,
    operations: dataset,
  });
  if (bulkResponse.errors) {
    const erroredDocuments: any[] = [];
    // The items array has the same order of the dataset we just indexed.
    // The presence of the `error` key indicates that the operation
    // that we did for the document has failed.
    bulkResponse.items.forEach((action: any, i) => {
      const operation = Object.keys(action)[0];
      if (action[operation].error) {
        erroredDocuments.push({
          // If the status is 429 it means that you can retry the document,
          // otherwise it's very likely a mapping error, and you should
          // fix the document before to try it again.
          status: action[operation].status,
          error: action[operation].error,
          operation: dataset[i * 2],
          document: dataset[i * 2 + 1],
        });
      }
    });
    console.log(erroredDocuments);
    throw new Error(erroredDocuments.map((e) => e.error).join(","));
  }
}
export async function tryCreateBulk(trademarks: TrademarkInfo[]) {
  let retry = 3;
  while (retry > 0) {
    try {
      return await createBulk(trademarks);
    } catch (e) {
      console.error(e);
      retry--;
    }
  }
}

export async function tryDeleteBulk(trademarks: TrademarkInfo[]) {

  let retry = 3;
  while (retry > 0) {
    try {
      await bulkDelete(trademarks);
    } catch (e) {
      console.error(e);
      retry--;
    }
  }
}

export async function bulkDelete(trademarks: TrademarkInfo[]) {
  return client.bulk({
    refresh: true,
    operations: trademarks.map((t) => {
      return { delete: { _index: "trademarks", _id: t.applicationNumber } };
    }),
  });
}

function parseDate(dateString: string | undefined): Date | null {
  if (!dateString) return null;
  const [day, month, year] = dateString.split(".").map(Number);
  return new Date(Date.UTC(year, month - 1, day)); // Tháng bắt đầu từ 0 (0 = Tháng 1)
}
export async function countDate(dateRange: string): Promise<number> {
  const dates = dateRange.split("TO").map((d) => d.trim());
  const res = await client.search({
    index: "trademarks",
    query: {
      bool: {
        must: [
          {
            range: {
              application_date: {
                gte: dates[0],
                lte: dates[1],
              },
            },
          },
        ],
      },
    },
  });
  const total = res.hits.total as SearchTotalHits;
  return Number(total.value);
}
