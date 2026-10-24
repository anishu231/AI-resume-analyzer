function doPost(e) {
  try {
    const expectedToken = PropertiesService.getScriptProperties().getProperty("RELAY_TOKEN");
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    if (!expectedToken || !constantTimeEquals(String(payload.token || ""), expectedToken)) {
      return jsonResponse({ ok: false });
    }

    const to = String(payload.to || "").trim();
    const subject = String(payload.subject || "").trim();
    const body = String(payload.body || "");
    if (!/^\S+@\S+\.\S+$/.test(to) || !subject || !body || subject.length > 200 || body.length > 10000) {
      return jsonResponse({ ok: false });
    }

    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: body,
      name: "AI Resume Screening System",
    });
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Gmail relay could not send an email");
    return jsonResponse({ ok: false });
  }
}

function authorizeMail() {
  // Run once in the Apps Script editor to grant this script Gmail send access.
  MailApp.getRemainingDailyQuota();
}

function constantTimeEquals(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
