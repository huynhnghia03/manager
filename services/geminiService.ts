import { GoogleGenAI } from "@google/genai";
import { SalaryData } from "../types";

// NOTE: In a real production app, API keys should not be exposed on the client side.
// This is for demonstration using the env variable pattern requested.
const apiKey = process.env.API_KEY || ''; 

export const analyzeSalary = async (data: SalaryData): Promise<string> => {
  if (!apiKey) {
    return "Vui lòng cấu hình API Key cho Gemini để sử dụng tính năng này.";
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Bạn là một trợ lý tài chính và sức khỏe thân thiện. 
    Dưới đây là dữ liệu lương tháng ${data.month}/${data.year} của tôi:
    - Tổng giờ làm: ${data.totalHours}
    - Tổng giờ tăng ca: ${data.totalOvertime}
    - Tổng lương thực nhận: ${data.totalSalary}
    
    Hãy đưa ra một nhận xét ngắn gọn (khoảng 2-3 câu) về thu nhập và sức khỏe của tôi dựa trên số giờ làm việc. 
    Nếu tôi tăng ca nhiều, hãy nhắc nhở giữ gìn sức khỏe. Nếu lương cao, hãy chúc mừng. 
    Trả lời bằng tiếng Việt thân thiện, có emoji.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Không thể phân tích dữ liệu lúc này.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Đã có lỗi xảy ra khi kết nối với Gemini.";
  }
};