import { SalaryData } from '../types';

// Dynamic import for html2pdf
const loadHtml2Pdf = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    return html2pdf;
};

export const exportToPDF = async (data: SalaryData): Promise<void> => {
    const html2pdf = await loadHtml2Pdf();

    // Create HTML content for PDF
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto;">
      <h1 style="text-align: center; color: #1a1a1a; margin-bottom: 5px; font-size: 24px;">
        BẢNG CHẤM CÔNG
      </h1>
      <p style="text-align: center; color: #666; font-size: 14px; margin-bottom: 30px;">
        Tháng ${data.month} / ${data.year}
      </p>
      
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
        <h3 style="margin: 0 0 10px 0; color: #333; font-size: 14px;">TỔNG KẾT</h3>
        <table style="width: 100%;">
          <tr>
            <td style="padding: 5px 0;"><strong>Tổng giờ làm:</strong></td>
            <td style="padding: 5px 0;">${data.totalHours} giờ</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>Tổng tăng ca:</strong></td>
            <td style="padding: 5px 0;">${data.totalOvertime} giờ</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>Tổng lương:</strong></td>
            <td style="padding: 5px 0; color: #2563eb; font-weight: bold;">${data.totalSalary}</td>
          </tr>
        </table>
      </div>

      <h3 style="margin: 0 0 15px 0; color: #333; font-size: 14px;">CHI TIẾT NGÀY CÔNG</h3>
      
      <div style="display: flex; gap: 20px;">
        <div style="flex: 1;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #e5e7eb;">
                <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Ngày</th>
                <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Thứ</th>
                <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Giờ</th>
              </tr>
            </thead>
            <tbody>
              ${data.days.slice(0, 16).map((hours, i) => `
                <tr style="background: ${hours !== '' ? '#dcfce7' : '#fff'};">
                  <td style="border: 1px solid #d1d5db; padding: 6px; text-align: center;">${i + 1}</td>
                  <td style="border: 1px solid #d1d5db; padding: 6px; text-align: center;">${data.weekdays[i] || '-'}</td>
                  <td style="border: 1px solid #d1d5db; padding: 6px; text-align: center; font-weight: ${hours !== '' ? 'bold' : 'normal'};">${hours || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div style="flex: 1;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #e5e7eb;">
                <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Ngày</th>
                <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Thứ</th>
                <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Giờ</th>
              </tr>
            </thead>
            <tbody>
              ${data.days.slice(16, 31).map((hours, i) => `
                <tr style="background: ${hours !== '' ? '#dcfce7' : '#fff'};">
                  <td style="border: 1px solid #d1d5db; padding: 6px; text-align: center;">${i + 17}</td>
                  <td style="border: 1px solid #d1d5db; padding: 6px; text-align: center;">${data.weekdays[i + 16] || '-'}</td>
                  <td style="border: 1px solid #d1d5db; padding: 6px; text-align: center; font-weight: ${hours !== '' ? 'bold' : 'normal'};">${hours || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      
      <p style="text-align: right; color: #999; font-size: 10px; margin-top: 20px;">
        Xuất lúc: ${new Date().toLocaleString('vi-VN')}
      </p>
    </div>
  `;

    // Create a temporary element
    const element = document.createElement('div');
    element.innerHTML = htmlContent;
    document.body.appendChild(element);

    const filename = `BangChamCong_Thang${data.month}_${data.year}.pdf`;

    // Generate PDF
    await html2pdf()
        .set({
            margin: 10,
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        })
        .from(element)
        .save();

    // Clean up
    document.body.removeChild(element);
};
