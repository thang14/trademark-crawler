export interface NiceClass {
    code: string;
    description: string;
  }
  
  export interface ClassificationOfShape {
    code: string;
    number: string;
  }
  
  export interface Applicant {
    name: string;
    address: string;
  }
  
  export interface IPRepresentative {
    name: string;
    address: string;
  }
  
  export interface TrademarkInfo {
    logo: string;
    name: string;
    applicationNumber: string;
    applicationDate: string;
    publicationNumber: string;
    publicationDate: string;
    applicationType: string;
    color: string;
    expiredDate: string;
    nices: NiceClass[];
    certificateNumber: string;
    certificateDate: string;
    status: string;
    classificationOfShapes: ClassificationOfShape[];
    applicant: Applicant;
    ipRepresentative: IPRepresentative;
    exclude: string;
    template: string;
    translation: string;
    txs: Tx[]
  }

  export interface Tx {
    date: string,
    text: string,
    description: TxDescription[]
  }

  export interface TxDescription {
    inidCode: string,
    text: string
  }


export interface TrademarkGlobal {
    id: string;
    logo?: string;
    source?: string;
    name: string;
    colors?: string[];
    destination: string;
    status?: string;
    registrationDate?: string;
    expirationDate?: string;
    applicationLanguage?: string;
    basicRegistration?: string;
    indication?: string;
    holder: {
      name: string;
      address: string;
    };
    represent?: {
      name: string;
      address: string;
    };
    classOfShapes?: Array<{
      code: string;
      number: number;
      tip?: string | null;
    }>;
    classes: Array<{
      code?: string;
      description?: string;
    }>;
    txs: Array<{
      date?: string;
      text?: string;
      description: Array<{
        inidCode: string;
        text: string;
      }>;
    }>;
    exclude?: string
  }
  