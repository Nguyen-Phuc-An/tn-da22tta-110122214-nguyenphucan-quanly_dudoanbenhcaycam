const Chat = require('../models/Chat');
const Prediction = require('../models/Prediction');
const Disease = require('../models/Disease');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Gemini AI initialization
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Chat với AI về bệnh đã dự đoán
 * 
 * Body:
 *   - prediction_id (required): ID dự đoán
 *   - message (required): Câu hỏi từ user
 * 
 * Luồng:
 * 1. Nhận message + prediction_id
 * 2. Tìm hoặc tạo chat
 * 3. Lưu message user
 * 4. Lấy disease từ Prediction
 * 5. Build context + history
 * 6. Gọi Gemini
 * 7. Lưu reply
 * 8. Trả kết quả
 */
const chatWithAI = async (req, res) => {
  try {
    const { message, prediction_id } = req.body;

    // ✓ 1. Kiểm tra input
    if (!message || !prediction_id) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp message và prediction_id',
      });
    }

    if (!message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Tin nhắn không được trống',
      });
    }

    // ✓ 2. Kiểm tra prediction tồn tại
    const prediction = await Prediction.findById(prediction_id);

    if (!prediction) {
      return res.status(404).json({
        success: false,
        message: 'Dự đoán không tồn tại',
      });
    }

    // ✓ 3. Kiểm tra quyền
    if (prediction.user_id.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền chat về dự đoán này',
      });
    }

    console.log(`\n💬 Chat với AI về bệnh: ${prediction.ket_qua_benh}`);

    // ✓ 4. Tìm hoặc tạo chat
    let chat = await Chat.findOne({
      user_id: req.userId,
      prediction_id,
    });

    if (!chat) {
      chat = new Chat({
        user_id: req.userId,
        prediction_id,
        messages: [],
      });
      console.log(`✓ Tạo phiên chat mới`);
    }

    // ✓ 5. Lưu message user
    chat.messages.push({
      role: 'user',
      content: message.trim(),
    });

    console.log(`✓ Lưu message user: ${message.substring(0, 50)}...`);

    // ✓ 6. Lấy thông tin bệnh từ Prediction
    const disease = await Disease.findOne({
      ten_benh: prediction.ket_qua_benh,
    })
      .populate('goi_y_phan_bon', 'ten_phan_bon')
      .populate('goi_y_thuoc', 'ten_thuoc');

    if (!disease) {
      return res.status(500).json({
        success: false,
        message: 'Không tìm thấy thông tin bệnh trong database',
      });
    }

    // ✓ 7. Build context + history
    // Lấy 5 tin gần nhất (sau khi thêm user message)
    const history = chat.messages
      .slice(-6, -1)  // Lấy 5 tin trước user message hiện tại
      .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
      .join('\n');

    const diseaseContext = `
* Tên bệnh: ${disease.ten_benh}
* Mô tả: ${disease.mo_ta}
* Nguyên nhân: ${disease.nguyen_nhan}
* Hướng xử lý: ${disease.huong_xu_ly}
  * Phân bón đề nghị: ${(disease.goi_y_phan_bon || []).map((item) => item.ten_phan_bon).filter(Boolean).join(', ') || 'Không có'}
  * Thuốc đề nghị: ${(disease.goi_y_thuoc || []).map((item) => item.ten_thuoc).filter(Boolean).join(', ') || 'Không có'}
    `;

    // ✓ 8. Tạo prompt cho Gemini
    const prompt = `
Bạn là chuyên gia nông nghiệp với kinh nghiệm nhiều năm.

Thông tin bệnh:
${diseaseContext}

Lịch sử hội thoại:
${history}

Người dùng hỏi:
"${message}"

Yêu cầu:
* Chỉ đề xuất phân bón/thuốc có trong phần thông tin bệnh ở trên
* Không tự tạo tên phân bón/thuốc mới ngoài cơ sở dữ liệu
* Trả lời đúng trọng tâm câu hỏi
* Dễ hiểu, ngắn gọn (3-5 câu)
* Nếu không đủ thông tin thì nói rõ
* Không trả lời lan man hoặc ngoài lề
    `;

    // ✓ 9. Gọi Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const reply = result.response.text();

    console.log(`✓ Gemini trả lời: ${reply.substring(0, 50)}...`);

    // ✓ 10. Lưu reply
    chat.messages.push({
      role: 'assistant',
      content: reply,
    });

    chat.updated_at = new Date();
    await chat.save();

    console.log(`✓ Lưu lịch sử chat`);

    // ✓ 11. Trả kết quả
    res.status(201).json({
      success: true,
      message: 'Chat thành công',
      data: {
        chat_id: chat._id,
        disease_name: disease.ten_benh,
        reply,
        messages: chat.messages,
        updated_at: chat.updated_at,
      },
    });

  } catch (error) {
    console.error('❌ Lỗi chat:', error.message);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống. Vui lòng thử lại sau.',
      error: error.message,
    });
  }
};

/**
 * Lấy lịch sử chat của 1 dự đoán
 * 
 * Params:
 *   - prediction_id: ID dự đoán
 * 
 * Response:
 *   {
 *     success: true,
 *     data: {
 *       _id: chat ID,
 *       messages: [Array of messages],
 *       created_at: ...,
 *       updated_at: ...
 *     }
 *   }
 */
const getChatByPrediction = async (req, res) => {
  try {
    const { prediction_id } = req.params;

    // ✓ Kiểm tra prediction tồn tại
    const prediction = await Prediction.findById(prediction_id);

    if (!prediction) {
      return res.status(404).json({
        success: false,
        message: 'Dự đoán không tồn tại',
      });
    }

    // ✓ Kiểm tra quyền
    if (prediction.user_id.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem lịch sử chat này',
      });
    }

    // ✓ Lấy chat
    const chat = await Chat.findOne({
      user_id: req.userId,
      prediction_id,
    }).populate('prediction_id', 'ket_qua_benh');

    console.log(`✓ Lấy lịch sử chat: ${chat ? chat.messages.length : 0} tin nhắn`);

    res.json({
      success: true,
      data: chat || {
        messages: [],
        message: 'Chưa có cuộc hội thoại nào',
      },
    });

  } catch (error) {
    console.error('❌ Lỗi lấy lịch sử chat:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  chatWithAI,
  getChatByPrediction,
};
