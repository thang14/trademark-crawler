import { Client } from "@elastic/elasticsearch";
import { TrademarkGlobal, TrademarkInfo } from "./interface";
import md5 from "md5";
import { SearchTotalHits } from "@elastic/elasticsearch/lib/api/types";
const client = new Client({
  node: process.env.ELASTICSEARCH_HOST,
});

export async function createIndex() {
  console.log("start create index");
  //await client.indices.delete({ index: "represents" });
  // await client.indices.delete({ index: "owners" });
  // await clien2.indices.create({
  //   index: "represents",
  //   mappings: {
  //     properties: {
  //       id: {
  //         type: "keyword",
  //       },
  //       name: {
  //         type: "text",
  //       },
  //       address: {
  //         type: "text",
  //       },
  //     },
  //   },
  // });

  // await clien2.indices.create({
  //   index: "owners",
  //   mappings: {
  //     properties: {
  //       id: {
  //         type: "keyword",
  //       },
  //       name: {
  //         type: "text",
  //       },
  //       address: {
  //         type: "text",
  //       },
  //     },
  //   },
  // });
  // await client.indices.delete({ index : "trademarks1"})
  // await client.indices.create({
  //   index: "trademarks1",
  //   settings: {
  //     similarity: {
  //       similarity: {
  //         type: "DFR",
  //         basic_model: "g",
  //         after_effect: "l",
  //         normalization: "h2",
  //       },
  //     },
  //     analysis: {
  //       analyzer: {
  //         lowercase: {
  //           tokenizer: "standard",
  //           type: "custom",
  //           filter: ["lowercase"],
  //         },
  //         tokenizer: {
  //           tokenizer: "tokenizer",
  //           type: "custom",
  //           filter: ["lowercase", "asciifolding"],
  //         },
  //         standard: {
  //           type: "custom",
  //           tokenizer: "standard",
  //           filter: ["lowercase", "asciifolding"],
  //         },
  //         phonetic: {
  //           tokenizer: "tokenizer",
  //           type: "custom",
  //           filter: ["lowercase", "asciifolding", "custom_metaphone"],
  //         },
  //       },
  //       filter: {
  //         custom_metaphone: {
  //           type: "phonetic",
  //           encoder: "double_metaphone",
  //           replace: false,
  //         },
  //       },
  //       tokenizer: {
  //         tokenizer: {
  //           type: "ngram",
  //           min_gram: 3,
  //           max_gram: 3,
  //           token_chars: ["letter", "digit"],
  //         },
  //       },
  //     },
  //   },
  //   mappings: {
  //     properties: {
  //       name: {
  //         type: "text",
  //         similarity: "similarity",
  //         analyzer: "tokenizer",
  //         fields: {
  //           vi: {
  //             type: "text",
  //             similarity: "similarity",
  //             analyzer: "lowercase",
  //           },
  //           phonetic: {
  //             type: "text",
  //             similarity: "similarity",
  //             analyzer: "phonetic",
  //           },
  //           standard: {
  //             type: "text",
  //             similarity: "similarity",
  //             analyzer: "standard",
  //           },
  //         },
  //       },
  //       type: {
  //         type: "keyword",
  //       },
  //       logo: {
  //         type: "keyword",
  //       },
  //       application_number: {
  //         type: "keyword",
  //       },
  //       application_date: {
  //         type: "date",
  //       },
  //       application_type: {
  //         type: "keyword",
  //       },
  //       colors: {
  //         type: "keyword",
  //       },
  //       publication_number: {
  //         type: "keyword",
  //       },
  //       publication_date: {
  //         type: "date",
  //       },
  //       application_owner_id: {
  //         type: "keyword",
  //       },
  //       expired_date: {
  //         type: "date",
  //       },
  //       nices: {
  //         type: "nested",
  //         properties: {
  //           code: {
  //             type: "keyword",
  //           },
  //           description: {
  //             type: "text",
  //             analyzer: "standard",
  //           },
  //         },
  //       },
  //       certificate_number: {
  //         type: "keyword",
  //       },
  //       certificate_date: {
  //         type: "keyword",
  //       },
  //       status: {
  //         type: "keyword",
  //       },
  //       classification_of_shapes: {
  //         type: "nested",
  //         properties: {
  //           code: {
  //             type: "keyword",
  //           },
  //           number: {
  //             type: "keyword",
  //           },
  //         },
  //       },
  //       represent_id: {
  //         type: "keyword",
  //       },
  //       exclude: {
  //         type: "text",
  //       },
  //       template: {
  //         type: "keyword",
  //       },
  //       translation: {
  //         type: "keyword",
  //       },
  //       source: {
  //         type: "keyword",
  //       },
  //       destination: {
  //         type: "keyword",
  //       },
  //       txs: {
  //         type: "nested",
  //         properties: {
  //           date: {
  //             type: "keyword",
  //           },
  //           text: {
  //             type: "keyword",
  //           },
  //           description: {
  //             type: "nested",
  //             properties: {
  //               inidCode: {
  //                 type: "keyword",
  //               },
  //               text: {
  //                 type: "keyword",
  //               },
  //             },
  //           },
  //         },
  //       },
  //       lastUpdate: {
  //         type: "date",
  //       },
  //     },
  //   },
  // });

  // await client.reindex({
  //   source: {
  //     index: "trademarks",
  //   },
  //   dest: {
  //     index: "trademarks1",
  //   },
  // });
  console.log("create index scueess");
}

let dateRangeBy = "application_date";

export function setDateRangeBy(by: string) {
  dateRangeBy = by;
}

export function getDateRangeBy() {
  return dateRangeBy;
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
    type: "national", // international
    source: "VN",
    destination: "VN",
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
    txs: trademark.txs,
    lastUpdate: new Date(),
  });
  return dataset;
}

function createDocumentWipoGlobal(trademark: TrademarkGlobal) {
  const ownerId = md5(trademark.holder.name + trademark.holder.address);
  const dataset = [];
  dataset.push({ index: { _index: "owners", _id: ownerId } });
  dataset.push({
    name: trademark.holder.name,
    address: trademark.holder.address,
  });

  let representId = null;
  if (trademark.represent) {
    representId = md5(trademark.represent.name + trademark.represent.address);
    dataset.push({ index: { _index: "represents", _id: representId } });
    dataset.push({
      name: trademark.represent.name,
      address: trademark.represent.address,
    });
  }

  dataset.push({
    index: { _index: "trademarks", _id: trademark.id },
  });
  dataset.push({
    name: trademark.name,
    type: "international", // international
    source: trademark.source,
    destination: trademark.destination,
    logo: trademark.logo,
    application_number: trademark.id,
    application_date: parseDate(trademark.registrationDate),
    application_type: null,
    colors: trademark.colors,
    publication_number: null,
    publication_date: null,
    application_owner_id: ownerId,
    expired_date: parseDate(trademark.expirationDate),
    nices: trademark.classes,
    certificate_number: null,
    certificate_date: null,
    status: trademark.status,
    classification_of_shapes: trademark.classOfShapes!.filter((c) => !!c.code),
    represent_id: representId || null,
    indication: trademark.indication || null,
    exclude: trademark.exclude || null,
    template: null,
    translation: null,
    txs: trademark.txs,
    lastUpdate: new Date(),
  });
  return dataset;
}

export async function createBulkGlobal(trademarks: TrademarkGlobal[]) {
  let dataset: any[] = [];
  for (let trademark of trademarks) {
    dataset = dataset.concat(createDocumentWipoGlobal(trademark));
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

// async function tryDeleteBulk(trademarks: TrademarkInfo[]) {
//   let retry = 3;
//   while (retry > 0) {
//     try {
//       return await bulkDelete(trademarks);
//     } catch (e) {
//       console.error(e);
//       retry--;
//     }
//   }
// }

// async function bulkDelete(trademarks: TrademarkInfo[]) {
//   return client.bulk({
//     refresh: true,
//     operations: trademarks.map((t) => {
//       return { delete: { _index: "trademarks", _id: t.applicationNumber } };
//     }),
//   });
// }

// export async function tryDeleteByDaterange(dateRange: string) {
//   let retry = 3;
//   while (retry > 0) {
//     try {
//       return await deleteByDaterange(dateRange);
//     } catch (e) {
//       console.error(e);
//       retry--;
//     }
//   }
// }

// export async function deleteByDaterange(dateRange: string) {
//   const dates = dateRange.split("TO").map((d) => d.trim());
//   return client.deleteByQuery({
//     index: "trademarks",
//     query: {
//       bool: {
//         must: [
//           {
//             range: {
//               [dateRangeBy]: {
//                 gte: dates[0],
//                 lte: dates[1],
//               },
//             },
//           },
//         ],
//       },
//     },
//   });
// }

export function parseDate(dateString: string | undefined): Date | null {
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
            match: {
              type: "national",
            },
          },
          {
            range: {
              [dateRangeBy]: {
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

export async function countDate2(dateRange: string): Promise<number> {
  const dates = dateRange.split("TO").map((d) => d.trim());
  const res = await client.search({
    index: "trademarks",
    query: {
      bool: {
        must: [
          {
            range: {
              [dateRangeBy]: {
                gte: dates[0],
                lte: dates[1],
              },
            },
          },
          {
            nested: {
              path: "nices",
              query: {
                bool: {
                  must: [{ match: { "nices.code": "5" } }],
                },
              },
              score_mode: "avg",
            },
          },
        ],
      },
    },
  });
  const total = res.hits.total as SearchTotalHits;
  return Number(total.value);
}


// Hàm lấy dữ liệu theo trường lastUpdate cũ nhất
export async function getOldestData(size = 10): Promise<any[]> {
  try {
      // Truy vấn Elasticsearch
      const response = await client.search({
          index: "trademarks",
          body: {
              sort: [
                  { "lastUpdate": { order: 'asc' } } // Sắp xếp tăng dần theo trường lastUpdate
              ],
              size: size, // Số lượng kết quả cần lấy
              query: {
                match: { type: 'national' }
              }
          }
      });

      // Trả về danh sách kết quả
      return response.hits.hits.map(hit => hit._source);
  } catch (error) {
      console.error('Error fetching data:', error);
      return [];
  }
}
