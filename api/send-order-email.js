// api/send-order-email.js
import { Resend } from 'resend';

// 初始化 Resend 客户端
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const data = req.body;

  // 验证必要字段
  if (!data.orderId || !data.invoiceInfo?.companyName || !data.registerInfo?.adminEmail) {
    return res.status(400).json({ error: '缺少必要信息' });
  }

  // 构建销售邮件 HTML
  const salesEmailHtml = buildSalesEmailHtml(data);
  
  // 构建客户邮件 HTML
  const customerEmailHtml = buildCustomerEmailHtml(data);

  try {
    // 检查 API Key 是否配置
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY 未配置');
      console.log('========== 销售邮件内容 ==========');
      console.log(salesEmailHtml);
      console.log('========== 客户邮件内容 ==========');
      console.log(customerEmailHtml);
      return res.status(200).json({ 
        success: true, 
        message: '邮件已记录（开发模式），请配置 RESEND_API_KEY' 
      });
    }

    // 发送邮件给销售
    const salesResult = await resend.emails.send({
      from: `RobotCare <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`,
      to: ['sales@mictekauto.com'],
      subject: `【待处理订单】${data.invoiceInfo.companyName} - ${data.plan}套餐 - ${data.orderId}`,
      html: salesEmailHtml,
      replyTo: data.registerInfo.adminEmail, // 方便销售直接回复客户
    });

    // 发送确认邮件给客户
    const customerResult = await resend.emails.send({
      from: `RobotCare <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`,
      to: [data.registerInfo.adminEmail],
      subject: `订单确认 - RobotCare服务申请 - ${data.orderId}`,
      html: customerEmailHtml,
    });

    // 检查发送结果
    if (salesResult.error) {
      console.error('销售邮件发送失败:', salesResult.error);
      return res.status(500).json({ error: '销售邮件发送失败' });
    }

    if (customerResult.error) {
      console.error('客户邮件发送失败:', customerResult.error);
      // 即使客户邮件失败，也返回成功（销售邮件已发送）
    }

    return res.status(200).json({ 
      success: true, 
      message: '邮件发送成功',
      salesEmailId: salesResult.data?.id,
      customerEmailId: customerResult.data?.id
    });

  } catch (error) {
    console.error('发送邮件失败:', error);
    return res.status(500).json({ 
      error: '发送邮件失败，请稍后重试',
      details: error.message 
    });
  }
}

// 构建销售邮件 HTML
function buildSalesEmailHtml(data) {
  const planBadge = data.planCode !== 'free' 
    ? '<span style="background:#f59e0b; color:white; padding:2px 10px; border-radius:20px; font-size:12px;">买11送1优惠</span>' 
    : '<span style="background:#10b981; color:white; padding:2px 10px; border-radius:20px; font-size:12px;">免费版</span>';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; line-height: 1.5; }
        .container { max-width: 700px; margin: 0 auto; background: #ffffff; }
        .header { background: linear-gradient(135deg, #38bdf8 0%, #a78bfa 100%); color: white; padding: 30px; text-align: center; }
        .header h2 { margin: 0; font-size: 24px; }
        .content { padding: 30px; background: #f8fafc; }
        .info-card { background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #38bdf8; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .info-card h3 { margin: 0 0 15px 0; color: #1e293b; display: flex; align-items: center; gap: 8px; }
        .info-row { display: flex; margin: 8px 0; padding: 4px 0; border-bottom: 1px solid #e2e8f0; }
        .info-label { width: 120px; font-weight: 600; color: #475569; flex-shrink: 0; }
        .info-value { color: #1e293b; flex: 1; }
        .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 8px; }
        .success-box { background: #e6f7e6; padding: 15px; border-radius: 8px; margin-top: 15px; }
        .footer { padding: 20px; background: #f1f5f9; text-align: center; color: #64748b; font-size: 12px; }
        @media (max-width: 600px) {
          .info-row { flex-direction: column; }
          .info-label { width: 100%; margin-bottom: 4px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🔔 新订单待处理通知</h2>
          <p>RobotCare 企业服务申请</p>
        </div>
        <div class="content">
          <!-- 订单信息 -->
          <div class="info-card">
            <h3>📋 订单信息</h3>
            <div class="info-row">
              <div class="info-label">订单号：</div>
              <div class="info-value"><strong>${data.orderId}</strong></div>
            </div>
            <div class="info-row">
              <div class="info-label">选择套餐：</div>
              <div class="info-value"><strong>${data.plan || '未填写'}</strong> ${planBadge}</div>
            </div>
            <div class="info-row">
              <div class="info-label">应付金额：</div>
              <div class="info-value"><strong style="color: #f59e0b; font-size: 18px;">¥${data.amount?.toLocaleString() || '0'}</strong> 元/年</div>
            </div>
            <div class="info-row">
              <div class="info-label">提交时间：</div>
              <div class="info-value">${data.submitTime || new Date().toLocaleString('zh-CN')}</div>
            </div>
          </div>
          
          <!-- 发票信息 -->
          <div class="info-card">
            <h3>💰 发票信息</h3>
            <div class="info-row">
              <div class="info-label">公司名称：</div>
              <div class="info-value"><strong>${data.invoiceInfo.companyName}</strong></div>
            </div>
            <div class="info-row">
              <div class="info-label">纳税人识别号：</div>
              <div class="info-value">${data.invoiceInfo.taxNumber || '未填写'}</div>
            </div>
            <div class="info-row">
              <div class="info-label">注册地址：</div>
              <div class="info-value">${data.invoiceInfo.address || '未填写'}</div>
            </div>
            <div class="info-row">
              <div class="info-label">公司电话：</div>
              <div class="info-value">${data.invoiceInfo.phone || '未填写'}</div>
            </div>
            <div class="info-row">
              <div class="info-label">开户银行：</div>
              <div class="info-value">${data.invoiceInfo.bankName || '未填写'}</div>
            </div>
            <div class="info-row">
              <div class="info-label">银行账号：</div>
              <div class="info-value">${data.invoiceInfo.bankAccount || '未填写'}</div>
            </div>
          </div>
          
          <!-- 注册信息 -->
          <div class="info-card">
            <h3>👤 管理员账户信息</h3>
            <div class="info-row">
              <div class="info-label">登录邮箱：</div>
              <div class="info-value"><strong>${data.registerInfo.adminEmail}</strong></div>
            </div>
            <div class="info-row">
              <div class="info-label">显示名称：</div>
              <div class="info-value">${data.registerInfo.displayName}</div>
            </div>
            <div class="info-row">
              <div class="info-label">联系电话：</div>
              <div class="info-value">${data.registerInfo.contactPhone}</div>
            </div>
            <div class="info-row">
              <div class="info-label">所在地区：</div>
              <div class="info-value">${data.registerInfo.fullLocation || (data.registerInfo.province + ' ' + data.registerInfo.city)}</div>
            </div>
            ${data.registerInfo.remark ? `
            <div class="info-row">
              <div class="info-label">备注信息：</div>
              <div class="info-value">${data.registerInfo.remark}</div>
            </div>
            ` : ''}
          </div>
          
          <!-- 待办事项 -->
          <div class="warning-box">
            <p><strong>⚠️ 销售待办事项：</strong></p>
            <ol style="margin: 10px 0 0 20px; color: #92400e;">
              <li>核对银行账户是否收到款项（转账备注：${data.orderId}）</li>
              <li>确认收款后，根据发票信息开具增值税专用发票</li>
              <li>根据注册信息在 RobotCare 后台创建管理员账号（邮箱：${data.registerInfo.adminEmail}）</li>
              <li>账号创建后，发送开通通知邮件给客户，包含初始密码和登录链接</li>
              <li>在订单系统中标记为已完成</li>
            </ol>
          </div>
          
          <!-- 快速操作清单 -->
          <div class="success-box">
            <p style="margin: 0; color: #2e7d32;"><strong>📋 快速操作清单：</strong></p>
            <ul style="margin: 10px 0 0 20px; color: #2e7d32;">
              <li>✅ 确认到账金额：¥${data.amount?.toLocaleString() || '0'}</li>
              <li>✅ 开票信息已完整${data.invoiceInfo.bankName ? '，可开具专票' : '，建议补充银行信息'}</li>
              <li>✅ 客户邮箱：${data.registerInfo.adminEmail}</li>
              <li>✅ 联系电话：${data.registerInfo.contactPhone}</li>
            </ul>
          </div>
        </div>
        <div class="footer">
          <p>此邮件由 RobotCare 系统自动发送，请勿直接回复。</p>
          <p>© 2025 MiCTek Automation — RobotCare 机器人数字生命线</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// 构建客户确认邮件 HTML
function buildCustomerEmailHtml(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; line-height: 1.5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #38bdf8 0%, #a78bfa 100%); color: white; padding: 30px; text-align: center; border-radius: 16px 16px 0 0; }
        .content { padding: 30px; background: #f8fafc; }
        .info-box { background: #f0f9ff; padding: 15px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #38bdf8; }
        .footer { margin-top: 20px; padding: 20px; text-align: center; background: #f1f5f9; border-radius: 8px; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🎉 订单已提交成功</h2>
          <p>感谢您选择 RobotCare！</p>
        </div>
        <div class="content">
          <p>尊敬的用户，您好！</p>
          <p>您的订单已成功提交，我们已收到您的申请。</p>
          
          <div class="info-box">
            <p><strong>📦 订单详情：</strong></p>
            <ul style="margin: 10px 0 0 20px;">
              <li>订单号：<strong>${data.orderId}</strong></li>
              <li>套餐：${data.plan}</li>
              <li>金额：<strong>¥${data.amount?.toLocaleString() || '0'}</strong> 元/年</li>
              <li>管理员邮箱：${data.registerInfo.adminEmail}</li>
            </ul>
          </div>
          
          <p>我们的销售团队将在确认收款后：</p>
          <ol style="margin: 10px 0 20px 20px;">
            <li>为您开具增值税专用发票</li>
            <li>创建您的 RobotCare 管理员账号</li>
            <li>发送开通通知邮件至 ${data.registerInfo.adminEmail}</li>
          </ol>
          
          <p>预计处理时间：1-2个工作日（确认收款后）</p>
          <p>如有任何疑问，请联系销售：<strong>sales@mictekauto.com</strong></p>
        </div>
        <div class="footer">
          <p>RobotCare · 机器人数字生命线</p>
          <p>芈科自动化科技（苏州）有限公司</p>
        </div>
      </div>
    </body>
    </html>
  `;
}