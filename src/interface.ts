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
  }