const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (env.smtpHost && env.smtpUser && env.smtpPass) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
    });
  }
  return transporter;
}

/**
 * Gửi email đặt lại mật khẩu cho người dùng
 * @param {string} toEmail - Địa chỉ email người nhận
 * @param {string} resetUrl - Đường link chứa token để đặt lại mật khẩu
 */
async function sendResetPasswordEmail(toEmail, resetUrl) {
  const mailTransporter = getTransporter();

  const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Đặt lại mật khẩu FurneeHome</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f6f5f0; color: #233028;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f6f5f0; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2ded5;">
          <!-- Header -->
          <tr>
            <td style="background-color: #205c46; padding: 28px 32px; text-align: left;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Furnee<span style="color: #d97745;">Home</span></h1>
              <p style="margin: 4px 0 0 0; color: #d6e4dc; font-size: 13px;">Nội thất & Không gian sống phong cách</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px 0; color: #153e2f; font-size: 20px; font-weight: 700;">Yêu cầu đặt lại mật khẩu</h2>
              <p style="margin: 0 0 16px 0; line-height: 1.6; color: #4a5951; font-size: 15px;">
                Xin chào, chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với địa chỉ email này trên FurneeHome.
              </p>
              <p style="margin: 0 0 24px 0; line-height: 1.6; color: #4a5951; font-size: 15px;">
                Nhấp vào nút bên dưới để tiến hành tạo mật khẩu mới cho tài khoản của bạn:
              </p>

              <!-- Action Button -->
              <table border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #205c46;">
                    <a href="${resetUrl}" target="_blank" style="font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; display: inline-block; background-color: #205c46; letter-spacing: 0.3px;">
                      Đặt lại mật khẩu ngay
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry & Warning -->
              <div style="background-color: #faf9f5; border-left: 4px solid #d97745; padding: 14px 16px; border-radius: 4px; margin: 24px 0 20px 0;">
                <p style="margin: 0; font-size: 13px; color: #6d6b63; line-height: 1.5;">
                  ⏱️ <strong>Lưu ý bảo mật:</strong> Liên kết này chỉ có hiệu lực trong vòng <strong>15 phút</strong> và chỉ sử dụng được 1 lần duy nhất.
                </p>
              </div>

              <p style="margin: 20px 0 8px 0; font-size: 13px; color: #839088;">
                Nếu bạn không gửi yêu cầu này, bạn có thể an tâm bỏ qua email. Mật khẩu hiện tại của bạn vẫn an toàn và không thay đổi.
              </p>

              <hr style="border: none; border-top: 1px solid #ebe8e1; margin: 24px 0 16px 0;" />
              <p style="margin: 0; font-size: 12px; color: #9aa59e; line-height: 1.5;">
                Nếu không bấm được nút phía trên, bạn có thể sao chép liên kết này vào trình duyệt:<br>
                <a href="${resetUrl}" style="color: #205c46; word-break: break-all;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f1efe9; padding: 18px 32px; text-align: center; border-top: 1px solid #e2ded5;">
              <p style="margin: 0; font-size: 12px; color: #7f8a84;">
                © ${new Date().getFullYear()} FurneeHome. Mọi quyền được bảo lưu.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const textContent = `Xin chào,\n\nBạn đã yêu cầu đặt lại mật khẩu cho tài khoản FurneeHome.\nVui lòng truy cập liên kết sau trong vòng 15 phút để tạo mật khẩu mới:\n${resetUrl}\n\nNếu bạn không yêu cầu, vui lòng bỏ qua email này.\n\nFurneeHome`;

  // Always output to console for easy local testing & development
  console.log('\n=================== [EMAIL RESET PASSWORD] ===================');
  console.log(`Gửi tới: ${toEmail}`);
  console.log(`Đường dẫn đặt lại mật khẩu:\n${resetUrl}`);
  console.log('==============================================================\n');

  if (mailTransporter) {
    try {
      await mailTransporter.sendMail({
        from: env.emailFrom,
        to: toEmail,
        subject: 'Khôi phục mật khẩu tài khoản FurneeHome',
        text: textContent,
        html: htmlContent,
      });
      console.log(`[EMAIL] Đã gửi mail thành công qua SMTP tới ${toEmail}`);
    } catch (err) {
      console.error('[EMAIL ERROR] Lỗi khi gửi mail qua SMTP:', err.message);
      // Don't throw error to caller so flow completes cleanly, but log failure
    }
  } else {
    console.log('[EMAIL NOTICE] Chưa cấu hình SMTP credentials trong .env. Link reset đã được in ra console ở trên để kiểm thử.');
  }

  return true;
}

module.exports = {
  sendResetPasswordEmail,
};
