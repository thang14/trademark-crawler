import PDFDocument from "pdfkit";
import fs from "fs";
import axios from "axios";
import { PassThrough } from 'stream';

interface TrademarkData {
  soDon: string; // Số đơn
  soDonChecksum: string; // Checksum của số đơn
  stt: string; // Số thứ tự
  nhanHieuImage: string; // Đường dẫn ảnh nhãn hiệu
  nhanHieuAlt: string; // Mô tả ảnh nhãn hiệu (alt)
  nhanHieuName: string; // Tên nhãn hiệu
  niceClassification: string; // Nhóm phân loại Nice
  status: string; // Trạng thái (VD: Cấp bằng)
  ngayNop: string; // Ngày nộp đơn
  soDonLink: string; // Liên kết tới chi tiết số đơn
  chuDon: string; // Tên chủ đơn
  daiDien: string; // Đại diện pháp lý
}

async function fetchImage(src: string) {
  const image = await axios.get(src, {
    responseType: "arraybuffer",
  });
  return image.data;
}

// Hàm tạo PDF với danh sách nhãn hiệu đã đăng ký
export async  function generateTrademarkPDF(
  newTrademark: string,
  trademarks: TrademarkData[],
  analysis: string,
  upload: (stream: PassThrough) => Promise<string> = savePDFToFile
) {
  const doc = new PDFDocument({ font: "./fonts/NotoSans.ttf"});
  const stream = new PassThrough();
  doc.pipe(stream);

  const images = await Promise.all(trademarks.map(trademark => {
    return fetchImage(trademark.nhanHieuImage);
  }))

   // Tiêu đề và thông tin công ty
   doc.fontSize(18).text('CÔNG TY TNHH SỞ HỮU TRÍ TUỆ TAGA', { align: 'center' });
   doc.moveDown(1).fontSize(14).text('-----***-----', { align: 'center' });
   doc.moveDown(1).text('THƯ TƯ VẤN', { align: 'center', underline: true });
   doc.moveDown(2);

   // Nhãn hiệu mới cần phân tích
   doc.fontSize(14).text(`Nhãn hiệu mới cần phân tích: "${newTrademark}"`).moveDown(1);


   doc.fontSize(14).text('Danh sách Nhãn hiệu đã Đăng ký:', { underline: true }).moveDown();
  // Duyệt và in thông tin từng nhãn hiệu
  trademarks.forEach((trademark, i) => {
    doc
      .fontSize(14)
      .text(`Số đơn: ${trademark.soDon}`, { underline: true })
      .moveDown();
    doc.text(`Tên nhãn hiệu: ${trademark.nhanHieuName}`);
    doc.text(`Nhóm phân loại: ${trademark.niceClassification}`);
    doc.text(`Trạng thái: ${trademark.status}`);
    doc.text(`Ngày nộp: ${trademark.ngayNop}`);
    doc.text(`Chủ đơn: ${trademark.chuDon}`);
    doc.moveDown();

    // In ảnh nhãn hiệu nếu cần
    doc.image(images[i], { width: 100 }); // Giới hạn kích thước ảnh
    doc.moveDown(2);
  });

  doc.fontSize(14).text('Kết quả Phân tích:', { underline: true }).moveDown();
  doc.fontSize(12).text(analysis, { align: 'justify' }).moveDown(2);

    // Kết thúc báo cáo
    doc.moveDown(2).fontSize(12).text(
        'Mọi thắc mắc vui lòng liên hệ: 0986 488 248 - Email: lienhe@luattaga.vn',
        { align: 'center' }
    );
    

  // Kết thúc tài liệu
  doc.end();
  return upload(stream);
}

export function testGenerateTrademarkPDF() {
  generateTrademarkPDF("viettel", [
    {
      soDon: "4-2005-11836",
      soDonChecksum: "gnh6vzsnzdv",
      stt: "1",
      nhanHieuImage:
        "https://r.vietnamtrademark.net/trademarks/2005/4200511836.jpg",
      nhanHieuAlt:
        "Nhãn hiệu VIETTEL POST của Tập đoàn Công nghiệp - Viễn thông Quân đội",
      nhanHieuName: "VIETTEL POST",
      niceClassification: "35, 39",
      status: "Cấp bằng",
      ngayNop: "13.09.2005",
      soDonLink: "/viettel-post-tm_4-2005-11836_gnh6vzsnzdv",
      chuDon: "Tập đoàn Công nghiệp - Viễn thông Quân đội",
      daiDien: "Văn phòng Luật sư Tân Hà",
    },
    {
      soDon: "4-2005-12345",
      soDonChecksum: "abc123xyz",
      stt: "2",
      nhanHieuImage: "https://r.vietnamtrademark.net/trademarks/2005/4200511836.jpg",
      nhanHieuAlt: "Nhãn hiệu ví dụ 2",
      nhanHieuName: "EXAMPLE BRAND 2",
      niceClassification: "25",
      status: "Đang giải quyết",
      ngayNop: "01.01.2021",
      soDonLink: "/example-brand-2",
      chuDon: "Công ty TNHH Ví dụ 2",
      daiDien: "Công ty Luật Ví dụ",
    },
  ], "Nội dung phân tích từ OpenAI");
}


// Function to save the PDF content from the stream
async function savePDFToFile(stream: PassThrough) {
    const writeStream = fs.createWriteStream("trademark_report.pdf"); // Create a writable stream to the file

    // Pipe the PassThrough stream to the file
    stream.pipe(writeStream);

    // Handle events
    writeStream.on('finish', () => {
        console.log('PDF file has been created: trademark_report.pdf');
    });

    writeStream.on('error', (error) => {
        console.error('Error writing to file:', error);
    });

    return "1";
}