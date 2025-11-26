// utils/mailer.js
const nodemailer = require('nodemailer');

function createTransporter() {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !EMAIL_FROM) {
        console.log('[mail] SMTP not fully configured, skipping email sending.');
        return null;
    }

    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: false,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        }
    });
}

/**
 * assignments: [{ giverId, receiverId }]
 * users: [{ id, name, email, notes }]
 */
async function sendAssignmentEmails(assignments, users) {
    const transporter = createTransporter();
    if (!transporter) {
        return { sent: false, reason: 'SMTP not configured' };
    }

    const from = process.env.EMAIL_FROM;
    const findUser = id => users.find(u => u.id === id);

    const rulesText = `
Budget: R200.
Keep it secret: Don't tell anyone who you are gifting to.
`;

    for (const assignment of assignments) {
        const giver = findUser(assignment.giverId);
        const receiver = findUser(assignment.receiverId);
        if (!giver || !receiver) continue;

        const mailOptions = {
            from,
            to: giver.email,
            subject: 'Your Secret Santa assignment 🎄',
            text: `Hi ${giver.name}!

You are the Secret Santa for: ${receiver.name}

Their preferences / notes:
${receiver.notes || 'No notes added yet.'}

Rules & guidelines:
${rulesText}

Merry Christmas and happy gifting! 🎁
`
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`[mail] Sent assignment to ${giver.email}`);
        } catch (err) {
            console.error(`[mail] Error sending to ${giver.email}:`, err.message);
        }
    }

    return { sent: true };
}

module.exports = {
    sendAssignmentEmails
};
