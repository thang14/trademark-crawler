import { parseProductInfo } from "./utils";

const puppeteer = require("puppeteer");

// Hàm bóc tách dữ liệu từ HTML
export async function extractProductDetails() {
  const browser = await puppeteer.launch({ headless: true }); // Chạy không giao diện
  const page = await browser.newPage();

  // Ví dụ HTML cần bóc tách
  const htmlContent = `
      <div class="product-details accordion-section-content" id="accordion-1a" style="display: block;">
   <div class="product-details">
      <div class="logoDetail">
         <div class="detail-container">
            <div class="row">
               <div class="col-md-2 product-form-label">
                  <span id="logoLabel">(540) Mẫu nhãn</span>
               </div>
               <div class="col-md-4 product-form-detail">
                  <div>
                     <div>
                        <div> <img class="rs-LOGO img-responsive detail-img" src="http://wipopublish.ipvietnam.gov.vn/wopublish-search/service/trademarks/application/VN4202224546/logo?noLogo=true"></div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
      <div>
         <div class="detail-container col-md-12">
            <div class="row">
               <div class="col-md-2 product-form-label">Loại đơn</div>
               <div class="col-md-4 product-form-details">Nhãn hiệu</div>
               <div class="col-md-2 product-form-label">Loại đơn</div>
               <div class="col-md-4 product-form-details">Thông thường</div>
            </div>
            <div class="row">
               <div class="col-md-2 product-form-label">(100) Số bằng và ngày cấp</div>
               <div class="col-md-4 product-form-details"><span class="margin-right-5">4-0494370-000</span><span>   03.06.2024</span></div>
               <div class="col-md-2 product-form-label">Trạng thái</div>
               <div class="col-md-4 product-form-details">Cấp bằng</div>
            </div>
            <div class="row">
               <div class="col-md-2 product-form-label">(180) Ngày hết hạn</div>
               <div class="col-md-4 product-form-details"><span class="margin-right-5"></span><span>   23.06.2032</span></div>
            </div>
            <div class="row">
               <div class="col-md-2 product-form-label">(200) Số đơn và Ngày nộp đơn</div>
               <div class="col-md-4 product-form-details"><span class="margin-right-5">VN -4-2022-24546</span><span>  23.06.2022</span></div>
               <div class="col-md-2 product-form-label">(400) Số công bố và ngày công bố</div>
               <div class="col-md-4 product-form-details">
                  <div class="row">
                     <div class="col-md-4">VN-4-2022-24546</div>
                     <div class="col-md-4"> 25.07.2024</div>
                     <div class="col-md-4"> 436B</div>
                  </div>
                  <div class="row">
                     <div class="col-md-4">VN-4-2022-24546</div>
                     <div class="col-md-4"> 26.09.2022</div>
                     <div class="col-md-4"> 436B</div>
                  </div>
               </div>
            </div>
            <div class="row">
               <div class="col-md-2 product-form-label">(541) Nhãn hiệu</div>
               <div class="col-md-4 product-form-details"><b>(VI)</b> viettel pay <br><b></b> </div>
               <div class="col-md-2 product-form-label">(591) Màu sắc nhãn hiệu</div>
               <div class="col-md-4 product-form-details">Đỏ, trắng.</div>
            </div>
            <div class="row">
               <div class="col-md-2 product-form-label">(300) Chi tiết về dữ liệu ưu tiên</div>
               <div class="col-md-4 product-form-details">
                  <div class="col-md-8 priority-table">
                     <div class="col-md-6"><span class="margin-right-5"></span><span> </span></div>
                     <div class="col-md-6"></div>
                  </div>
               </div>
            </div>
            <div class="row">
               <div class="col-md-2 product-form-label">(511) Nhóm sản phẩm/dịch vụ</div>
               <div class="col-md-10 product-form-details">
                  <div class="row">
                     <a target="_blank" href="https://www.wipo.int/classifications/nice/nclpub/en/fr/?basic_numbers=show&amp;class_number=36&amp;explanatory_notes=show&amp;lang=en&amp;menulang=en&amp;mode=flat&amp;notion=&amp;pagination=no&amp;version=20190101" rel="36" class="external-link">
                        <div class="col-md-2"><i class="fa fa-external-link"></i><span class="ext-link-text">36</span></div>
                        <div class="col-md-10">Dịch vụ tài chính; dịch vụ tín dụng; dịch vụ bảo hiểm; dịch vụ cung ứng hạ tầng thanh toán điện tử gồm: chuyển mạch tài chính, bù trừ điện tử; dịch vụ xử lý thanh toán điện tử (dịch vụ tài chính); dịch vụ thu hộ/chi hộ; dịch vụ chuyển tiền điện tử; dịch vụ thanh toán ví điện tử; dịch vụ thanh toán và bảo lãnh thanh toán (tài chính); dịch vụ trung gian tài chính; dịch vụ cho thuê tài chính; dịch vụ chuyển tiền (trong nước và quốc tế); dịch vụ hỗ trợ khách hàng trong việc thực hiện các giao dịch tài chính, ngân hàng thực hiện trên nền dịch vụ viễn thông, công nghệ thông tin và kết nối ngân hàng; dịch vụ cung cấp thông tin và tư vấn liên quan đến các dịch vụ kể trên.</div>
                     </a>
                  </div>
                  <div class="row">
                     <a target="_blank" href="https://www.wipo.int/classifications/nice/nclpub/en/fr/?basic_numbers=show&amp;class_number=38&amp;explanatory_notes=show&amp;lang=en&amp;menulang=en&amp;mode=flat&amp;notion=&amp;pagination=no&amp;version=20190101" rel="38" class="external-link">
                        <div class="col-md-2"><i class="fa fa-external-link"></i><span class="ext-link-text">38</span></div>
                        <div class="col-md-10">Dịch vụ viễn thông; dịch vụ internet; dịch vụ giá trị gia tăng trên nền viễn thông; dịch vụ cổng thanh toán điện tử, cụ thể là cung cấp đường truyền cho phép các website thương mại điện tử liên kết với các kênh thanh toán như ngân hàng, giúp khách hàng thanh toán hàng hóa, dịch vụ ngay trên website khi mua hàng; cung cấp các kênh viễn thông cho dịch vụ mua hàng từ xa; dịch vụ cung cấp thông tin và tư vấn liên quan đến các dịch vụ kể trên</div>
                     </a>
                  </div>
                  <div class="row">
                     <a target="_blank" href="https://www.wipo.int/classifications/nice/nclpub/en/fr/?basic_numbers=show&amp;class_number=39&amp;explanatory_notes=show&amp;lang=en&amp;menulang=en&amp;mode=flat&amp;notion=&amp;pagination=no&amp;version=20190101" rel="39" class="external-link">
                        <div class="col-md-2"><i class="fa fa-external-link"></i><span class="ext-link-text">39</span></div>
                        <div class="col-md-10">Dịch vụ đại lý vé máy bay; đặt chỗ cho các chuyến đi; dịch vụ sắp xếp việc vận chuyển cho các chuyến du lịch; dịch vụ thương mại điện tử trong lĩnh vực đặt vé tàu xe, đặt vé máy bay; du lịch; dịch vụ cung cấp thông tin và tư vấn liên quan đến các dịch vụ kể trên</div>
                     </a>
                  </div>
                  <div class="row">
                     <a target="_blank" href="https://www.wipo.int/classifications/nice/nclpub/en/fr/?basic_numbers=show&amp;class_number=42&amp;explanatory_notes=show&amp;lang=en&amp;menulang=en&amp;mode=flat&amp;notion=&amp;pagination=no&amp;version=20190101" rel="42" class="external-link">
                        <div class="col-md-2"><i class="fa fa-external-link"></i><span class="ext-link-text">42</span></div>
                        <div class="col-md-10">Dịch vụ công nghệ thông tin; dịch vụ nghiên cứu và ứng dụng công nghệ thông tin, viễn thông trong lĩnh vực tài chính, ngân hàng; dịch vụ thiết kế và lập trình các phần mềm ứng dụng trong lĩnh vực tài chính, ngân hàng; dịch vụ chuyển giao công nghệ trong lĩnh vực thanh toán bằng các phương tiện điện tử, viễn thông; cung cấp giải pháp công nghệ phục vụ cho dịch vụ thanh toán và sử dụng các phương tiện thông tin điện tử và thẻ thanh toán; dịch vụ cung cấp thông tin và tư vấn liên quan đến các dịch vụ kể trên</div>
                     </a>
                  </div>
                  <div class="row">
                     <a target="_blank" href="https://www.wipo.int/classifications/nice/nclpub/en/fr/?basic_numbers=show&amp;class_number=9&amp;explanatory_notes=show&amp;lang=en&amp;menulang=en&amp;mode=flat&amp;notion=&amp;pagination=no&amp;version=20190101" rel="9" class="external-link">
                        <div class="col-md-2"><i class="fa fa-external-link"></i><span class="ext-link-text">9</span></div>
                        <div class="col-md-10">Chương trình máy tính; phần mềm máy tính cho phép và xử lý việc thanh toán điện tử và chuyển giao các khoản thanh toán tới và từ người khác; ví điện tử (có thể tải xuống được); tệp tin dữ liệu, hình ảnh, âm thanh, phim, chương trình truyền hình, trò chơi (game), xuất bản phẩm điện tử có thể tải xuống được; thiết bị điện tử dùng để ghi, truyền, nhận, sao, lưu, hiện hình và lưu tin, gửi thư, thông tin và dữ liệu (thiết bị đơn nhất); thẻ được mã hóa để sử dụng liên quan đến chuyển khoản điện tử của giao dịch tài chính</div>
                     </a>
                  </div>
                  <div class="row">
                     <a target="_blank" href="https://www.wipo.int/classifications/nice/nclpub/en/fr/?basic_numbers=show&amp;class_number=35&amp;explanatory_notes=show&amp;lang=en&amp;menulang=en&amp;mode=flat&amp;notion=&amp;pagination=no&amp;version=20190101" rel="35" class="external-link">
                        <div class="col-md-2"><i class="fa fa-external-link"></i><span class="ext-link-text">35</span></div>
                        <div class="col-md-10">Dịch vụ quảng cáo; dịch vụ marketing; dịch vụ tư vấn, hỗ trợ quản lý và điều hành kinh doanh; nghiên cứu thị trường và thăm dò dư luận; dịch vụ khuyến mại; dịch vụ cung cấp sàn giao dịch trực tuyến cho người mua và người bán thực hiện việc mua bán hàng hoá, dịch vụ (dịch vụ sàn thương mại điện tử)</div>
                     </a>
                  </div>
               </div>
            </div>
            <div class="row">
               <div class="col-md-2 product-form-label">(531) Phân loại hình</div>
               <div class="col-md-10 product-form-details">
                  <div class="row">
                     <div class="col-md-12"><a target="_blank" href="https://www.wipo.int/classifications/nivilo/vienna/index.htm?lang=EN" rel="01" class="external-link"><i class="fa fa-external-link"></i><span class="ext-link-text">01.01.02 (7)</span></a></div>
                  </div>
                  <div class="row">
                     <div class="col-md-12"><a target="_blank" href="https://www.wipo.int/classifications/nivilo/vienna/index.htm?lang=EN" rel="01" class="external-link"><i class="fa fa-external-link"></i><span class="ext-link-text">01.01.09 (7)</span></a></div>
                  </div>
                  <div class="row">
                     <div class="col-md-12"><a target="_blank" href="https://www.wipo.int/classifications/nivilo/vienna/index.htm?lang=EN" rel="26" class="external-link"><i class="fa fa-external-link"></i><span class="ext-link-text">26.03.02 (7)</span></a></div>
                  </div>
                  <div class="row">
                     <div class="col-md-12"><a target="_blank" href="https://www.wipo.int/classifications/nivilo/vienna/index.htm?lang=EN" rel="26" class="external-link"><i class="fa fa-external-link"></i><span class="ext-link-text">26.03.07 (7)</span></a></div>
                  </div>
               </div>
            </div>
            <div class="row">
               <div class="col-md-2 product-form-label">(730) Chủ đơn/Chủ bằng</div>
               <div class="col-md-10 product-form-details">
                  <div id="apnaDiv" onclick="getOtherApplicants('Tập đoàn Công nghiệp - Viễn thông Quân Đội');" style="cursor: pointer" class="col-md-12 margin-bottom-10">
                     <div class="row"><a rel="otherApna" href="#" data-toggle="modal" data-target="#quickLinkAppDiv"> <i class="fa fa-external-link" data-placement="top" data-toggle="tooltip" data-original-title="Các đơn khác cùng chủ đơn"></i> <b>(VI)</b> Tập đoàn Công nghiệp - Viễn thông Quân Đội   : Lô D26, khu đô thị Cầu Giấy, phường Yên Hòa, quận Cầu Giấy, thành phố Hà Nội</a></div>
                     <div class="row"><a rel="otherApna" href="#" data-toggle="modal" data-target="#quickLinkAppDiv"><b></b>   </a></div>
                  </div>
               </div>
            </div>
            <div class="row">
               <div class="col-md-2 product-form-label">(740) Đại diện SHCN</div>
               <div class="col-md-10 product-form-details">
                  <div class="col-md-12 margin-bottom-10">
                     <div class="row"><b>(VI)</b> Văn phòng Luật sư Tân Hà   : Tổ 6 cụm Chùa, phường Nhân Chính, quận Thanh Xuân, TP Hà Nội</div>
                     <div class="row"><b></b>   </div>
                  </div>
               </div>
            </div>
            <div class="row">
               <div class="col-md-2 product-form-label">(571) Nhãn hiệu</div>
               <div class="col-md-10 product-form-details"></div>
            </div>
            <div class="row">
               <div class="col-md-2 product-form-label">(566) Nhãn hiệu dịch thuật</div>
               <div class="col-md-10 product-form-details">111</div>
            </div>
            <div class="row">
               <div class="col-md-2 product-form-label">(550) Kiểu của mẫu nhãn(hình/chữ/kết hợp)</div>
               <div class="col-md-10 product-form-details">Combined</div>
            </div>
            <div class="row">
               <div class="col-md-2 product-form-label">(526) Yếu tố loại trừ</div>
               <div class="col-md-10 product-form-details">Nhãn hiệu được bảo hộ tổng thể. Không bảo hộ riêng "pay".</div>
            </div>
         </div>
      </div>
   </div>
   <tr class="navigation">
		<td class="paginator-cell" colspan="11">
			<ul class="paginator search-result-display">				
				<li class="navigatorLabel results-display-text text-right"><div>Showing 1 - 50 of 787481 results </div></li>
				<!-- <li class="navigator pagination-center" style="z-index:10;"><div wicket:id="navigator">[navigator]</div></li> -->
				
			</ul>
		</td>
	</tr>
</div>
    `;

  // Thiết lập nội dung HTML
  await page.setContent(htmlContent);

  // Bóc tách dữ liệu từ HTML
  const data = await page.evaluate(() => {
    const rows = document.querySelectorAll(".detail-container > .row");

    function cleanString(input: string) {
        // Loại bỏ khoảng trắng không cần thiết xung quanh và giữa các ký tự
        return input.replace(/\s*-\s*/g, '-').trim();
    }
    

    function parseCertificateInfo() {
        const doc = rows[2];
        const formDetails = doc.querySelectorAll('.product-form-details')
        // Lấy thông tin số bằng và ngày cấp
        const certificateNumberElement = formDetails[0].querySelector('span:nth-of-type(1)');
        const certificateDateElement = formDetails[0].querySelector('span:nth-of-type(2)');
    
        // Lấy thông tin trạng thái
        const statusElement = formDetails[1];
    
        // Lấy nội dung
        const certificateNumber = certificateNumberElement ? certificateNumberElement.textContent?.trim() : '';
        const certificateDate = certificateDateElement ? certificateDateElement.textContent?.trim() : '';
        const status = statusElement ? statusElement.textContent?.trim() : '';
    
        return {
            certificateNumber, // Số bằng
            certificateDate,   // Ngày cấp
            status             // Trạng thái
        };
    }
    

    function parseApplicationInfo() {
      const doc = rows[4];
      const formDetails = doc.querySelectorAll('.product-form-details')

      // Lấy số đơn và ngày nộp đơn
      const applicationNumberElement = formDetails[0].querySelector('.margin-right-5');
      const applicationDateElement = formDetails[0].querySelector('span:nth-of-type(2)');

      // Lấy số công bố và ngày công bố
      const publicationNumberElement = formDetails[1].querySelector('.col-md-4:nth-child(1)');
      const publicationDateElement = formDetails[1].querySelector('.col-md-4:nth-child(2)');

      // Lấy nội dung
      const applicationNumber = applicationNumberElement
        ? applicationNumberElement.textContent?.trim()
        : "";
      const applicationDate = applicationDateElement
        ? applicationDateElement.textContent?.trim()
        : "";
      const publicationNumber = publicationNumberElement
        ? publicationNumberElement.textContent?.trim()
        : "";
      const publicationDate = publicationDateElement
        ? publicationDateElement.textContent?.trim()
        : "";

      return {
        applicationNumber: cleanString(applicationNumber || ""), // Số đơn
        applicationDate, // Ngày nộp đơn
        publicationNumber, // Số công bố
        publicationDate, // Ngày công bố
      };
    }

    function parseProductInfo() {
      // Lấy tất cả các hàng sản phẩm/dịch vụ
      const productRows = rows[7].querySelectorAll(
        ".product-form-details .row"
      );

      // Tạo cấu trúc dữ liệu để lưu thông tin
      const products = Array.from(productRows).map((row) => {
        const link = row.querySelector("a") as Element; // Lấy thẻ <a> chứa thông tin sản phẩm
        const code = link ? link.getAttribute("rel") : ""; // Mã sản phẩm từ thuộc tính rel
        const description = link
          ? link.querySelector(".col-md-10")?.textContent?.trim()
          : ""; // Mô tả sản phẩm

        return { code, description }; // Trả về đối tượng với mã và mô tả
      });

      return products; // Trả về danh sách sản phẩm
    }

    const getText = (row: number, div: number) => {
      return rows[row]
        .querySelectorAll("div")
        [div].textContent?.replace("\n", "")
        .trim()
        .replace("(VI)", "")
        .trim();
    };

    const getImageSrc = (selector: any) => {
      const element = document.querySelector(selector);
      return element ? element.src : "";
    };

    function parseClassificationOfShapesData() {
      // Lấy tất cả các thẻ <a> trong phần phân loại hình
      const typeLinks = rows[8].querySelectorAll(
        ".product-form-details .external-link"
      );

      // Tạo cấu trúc dữ liệu để lưu thông tin mã
      const types = Array.from(typeLinks).map((link) => {
        const classification = link
          .querySelector(".ext-link-text")
          ?.textContent?.trim(); // Lấy mã loại hình
        const match = classification?.match(/^(\S+)\s+\((\d+)\)$/); // Tách mã và số trong ngoặc

        return {
          code: match ? match[1] : "", // Mã phân loại
          number: match ? match[2] : "", // Số trong ngoặc
        };
      });

      return types; // Trả về danh sách loại hình nhãn hiệu
    }

    function parseApplicantInfo(input: string | undefined) {
      if (!input) return "";
      // Tách tên và địa chỉ tại dấu ":"
      const [name, address] = input.split(":").map((part) => part.trim());

      return {
        applicantName: name, // Tên chủ đơn
        applicantAddress: address, // Địa chỉ
      };
    }

    return {
      //rows: rows[0].getHTML(),
      logo: getImageSrc(".rs-LOGO"), // URL của mẫu nhãn
      name: getText(5, 1),
      ...parseApplicationInfo(),
      applicationType: getText(1, 3),
      color: getText(5, 3),
      expiredDate: getText(3, 1),
      nices: parseProductInfo(),
      ...parseCertificateInfo(),
      classificationOfShapes: parseClassificationOfShapesData(),
      applicant: parseApplicantInfo(getText(9, 1)),
      ipRepresentative: parseApplicantInfo(getText(10, 1)),
      exclude: getText(14, 1),
      template: getText(13, 1),
      translation: getText(12, 1)
    };
  });

  console.log("Dữ liệu đã tách:", data);

  await browser.close();
}
