interface Env {
  TURNSTILE_SECRET?: string;
  RESEND_API_KEY?: string;
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
  SPREADSHEET_ID?: string;
  ADMIN_EMAIL?: string;
  ALLOWED_ORIGINS?: string;
}

type PagesFunction<TEnv = unknown> = (context: {
  request: Request;
  env: TEnv;
}) => Promise<Response> | Response;

interface ContactPayload {
  company: string;
  department: string;
  name: string;
  email: string;
  phone: string;
  interest: string[];
  consideration_phase: string[];
  message: string;
  page_url: string;
  lp_id: string;
  lp_version: string;
  form_schema_version: string;
  locale: string;
  country: string;
  requested_material: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  turnstileToken: string;
}

interface ValidationError {
  field: string;
  message: string;
}

interface MailTemplate {
  subject: string;
  bodyHtml: string;
}

interface ResolvedTemplate {
  key: string;
  fallback: boolean;
  template: MailTemplate;
}

const ALLOWED_INTERESTS = ["品質管理", "研究開発", "海外規格対応", "その他"];
const ALLOWED_CONSIDERATION_PHASES = [
  "具体的に購入を検討している",
  "購入を前提に比較検討している",
  "導入予定は未定だが、将来的に検討している",
  "情報収集・市場調査のため",
];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_API_URL = "https://api.resend.com/emails";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const DEFAULT_TEMPLATE_KEY = "default__ja-JP";
// TODO(運用): 問い合わせ窓口メールを変更する場合はここを更新。
const SUPPORT_EMAIL_DEFAULT = "info@sun-kagaku.com";
// TODO(運用): 資料公開先のベースURLを実運用URLに合わせて更新。
const DOCUMENT_BASE_URL = "https://www.sun-texture-lab.com";

// TODO(運用): 資料ダウンロードURLを実ファイル配置に合わせて更新。
const MATERIAL_LINKS: Record<string, Array<{ label: string; url: string }>> = {
  lp_documents: [
    {
      label: "食品開発展2025セミナー資料「食品分析の最前線」",
      url: `${DOCUMENT_BASE_URL}/landing/jp/SD700II/documents/2025_exhibition_seminar.pdf`,
    },
    {
      label: "測定ソリューション機器ラインナップ比較資料",
      url: `${DOCUMENT_BASE_URL}/landing/jp/SD700II/documents/instrunments_comparison.pdf`,
    },
    {
      label: "SD-700II 製品カタログ",
      url: `${DOCUMENT_BASE_URL}/landing/jp/SD700II/documents/sd-700II_catalog.pdf`,
    },
  ],
};

const MAIL_TEMPLATES: Record<string, MailTemplate> = {
  // TODO(運用): 件名・本文はLP運用方針に合わせて編集。
  "texture-lp-jp-01__ja-JP__lp_documents": {
    subject: "【サン科学】資料ダウンロードありがとうございます",
    bodyHtml: [
      "<p>{{name}} 様</p>",
      "<p>このたびは資料ダウンロードのお申し込みをいただき、ありがとうございます。</p>",
      "<p>以下の資料セットを受け付けました。担当者より順次ご案内します。</p>",
      "<p><strong>対象資料:</strong> {{requested_material}}</p>",
      "<p><strong>資料一覧URL:</strong></p>",
      "{{material_links_html}}",
      "<p><strong>ページ:</strong> {{lp_name}}</p>",
      "<p><strong>会社名:</strong> {{company}}</p>",
      "<p><strong>お問い合わせ番号:</strong> {{trace_id}}</p>",
      "<p>※本メールは送信専用です。ご不明点は {{support_email}} までご連絡ください。</p>",
    ].join(""),
  },
  "texture-lp-jp-01__ja-JP": {
    subject: "【サン科学】資料ダウンロードありがとうございます",
    bodyHtml: [
      "<p>{{name}} 様</p>",
      "<p>このたびは資料ダウンロードのお申し込みをいただき、ありがとうございます。</p>",
      "<p>{{lp_name}} に関するお問い合わせを受け付けました。内容を確認のうえ、担当者よりご連絡いたします。</p>",
      "<p><strong>ご希望資料:</strong> {{requested_material}}</p>",
      "<p><strong>資料一覧URL:</strong></p>",
      "{{material_links_html}}",
      "<p><strong>会社名:</strong> {{company}}</p>",
      "<p>※本メールは送信専用です。ご不明点は {{support_email}} までご連絡ください。</p>",
    ].join(""),
  },
  "default__ja-JP": {
    subject: "【サン科学】お問い合わせありがとうございます",
    bodyHtml: [
      "<p>{{name}} 様</p>",
      "<p>このたびはお問い合わせありがとうございます。</p>",
      "<p>以下の内容で受け付けました。担当者より順次ご連絡します。</p>",
      "<p><strong>会社名:</strong> {{company}}</p>",
      "<p><strong>ご希望資料:</strong> {{requested_material}}</p>",
      "<p><strong>お問い合わせ番号:</strong> {{trace_id}}</p>",
      "<p>※本メールは送信専用です。ご不明点は {{support_email}} までご連絡ください。</p>",
    ].join(""),
  },
  "default__en-US": {
    subject: "[Sun Scientific] Thank you for your inquiry",
    bodyHtml: [
      "<p>{{name}},</p>",
      "<p>Thank you for contacting Sun Scientific.</p>",
      "<p>We have received your inquiry and will get back to you shortly.</p>",
      "<p><strong>Company:</strong> {{company}}</p>",
      "<p><strong>Requested material:</strong> {{requested_material}}</p>",
      "<p><strong>Material links:</strong></p>",
      "{{material_links_html}}",
      "<p><strong>Inquiry ID:</strong> {{trace_id}}</p>",
      "<p>This is an automated message. For support, please contact {{support_email}}.</p>",
    ].join(""),
  },
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
    },
  });
}

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeLocale(locale: string): string {
  const normalized = (locale || "ja-JP").replace("_", "-");
  if (normalized.toLowerCase() === "ja-jp") return "ja-JP";
  if (normalized.toLowerCase() === "en-us") return "en-US";
  return normalized;
}

function getLpDisplayName(lpId: string): string {
  const map: Record<string, string> = {
    // TODO(運用): LPを追加する場合は lp_id と表示名の対応をここに追加。
    "texture-lp-jp-01": "食感数値化のための測定器のご案内",
  };
  return map[lpId] || "お問い合わせLP";
}

function resolveTemplate(payload: ContactPayload): ResolvedTemplate {
  const locale = normalizeLocale(payload.locale);
  const lpId = payload.lp_id || "default";
  // TODO(運用): requested_material はフォーム hidden の値と一致させる。
  const requestedMaterial = payload.requested_material || "default";
  const candidates = [
    `${lpId}__${locale}__${requestedMaterial}`,
    `${lpId}__${locale}`,
    `${lpId}__default`,
    `default__${locale}`,
    DEFAULT_TEMPLATE_KEY,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const key = candidates[i];
    const template = MAIL_TEMPLATES[key];
    if (template) {
      return { key, template, fallback: i > 0 };
    }
  }

  return {
    key: DEFAULT_TEMPLATE_KEY,
    template: MAIL_TEMPLATES[DEFAULT_TEMPLATE_KEY],
    fallback: true,
  };
}

function buildMaterialLinksHtml(requestedMaterial: string): string {
  const links = MATERIAL_LINKS[requestedMaterial];
  if (!links || links.length === 0) {
    return `<p><a href="${DOCUMENT_BASE_URL}/documents" target="_blank" rel="noopener noreferrer">${DOCUMENT_BASE_URL}/documents</a></p>`;
  }
  const list = links
    .map((link) => `<li><a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a></li>`)
    .join("");
  return `<ul>${list}</ul>`;
}

function renderTemplate(template: MailTemplate, payload: ContactPayload, traceId: string, supportEmail: string): MailTemplate {
  const variables: Record<string, string> = {
    name: payload.name || "",
    company: payload.company || "",
    requested_material: payload.requested_material || "未指定",
    lp_name: getLpDisplayName(payload.lp_id),
    trace_id: traceId,
    support_email: supportEmail,
    material_links_html: buildMaterialLinksHtml(payload.requested_material),
  };

  const replaceVars = (input: string): string =>
    input.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, key) => {
      if (key === "material_links_html") return variables[key] ?? "";
      return escapeHtml(variables[key] ?? "");
    });

  return {
    subject: replaceVars(template.subject),
    bodyHtml: replaceVars(template.bodyHtml),
  };
}

function parsePayload(raw: unknown): ContactPayload {
  const source = (raw ?? {}) as Record<string, unknown>;
  const interest = Array.isArray(source.interest) ? source.interest.map((v) => String(v)) : [];
  const considerationPhase = Array.isArray(source.consideration_phase)
    ? source.consideration_phase.map((v) => String(v))
    : [];

  return {
    company: normalizeText(source.company),
    department: normalizeText(source.department),
    name: normalizeText(source.name),
    email: normalizeText(source.email),
    phone: normalizeText(source.phone),
    interest,
    consideration_phase: considerationPhase,
    message: normalizeText(source.message),
    page_url: normalizeText(source.page_url),
    lp_id: normalizeText(source.lp_id),
    lp_version: normalizeText(source.lp_version),
    form_schema_version: normalizeText(source.form_schema_version),
    locale: normalizeText(source.locale),
    country: normalizeText(source.country),
    requested_material: normalizeText(source.requested_material),
    utm_source: normalizeText(source.utm_source),
    utm_medium: normalizeText(source.utm_medium),
    utm_campaign: normalizeText(source.utm_campaign),
    turnstileToken: normalizeText(source.turnstileToken),
  };
}

function validate(payload: ContactPayload): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!payload.company) errors.push({ field: "company", message: "required" });
  if (!payload.name) errors.push({ field: "name", message: "required" });
  if (!payload.email) errors.push({ field: "email", message: "required" });
  if (!payload.turnstileToken) errors.push({ field: "turnstileToken", message: "required" });

  if (payload.email && !EMAIL_PATTERN.test(payload.email)) {
    errors.push({ field: "email", message: "invalid_format" });
  }
  if (payload.company.length > 200) errors.push({ field: "company", message: "max_200" });
  if (payload.name.length > 100) errors.push({ field: "name", message: "max_100" });
  if (payload.message.length > 3000) errors.push({ field: "message", message: "max_3000" });

  if (payload.interest.length > 0) {
    const invalid = payload.interest.find((v) => !ALLOWED_INTERESTS.includes(v));
    if (invalid) errors.push({ field: "interest", message: "invalid_option" });
  }

  if (payload.consideration_phase.length > 0) {
    const invalidPhase = payload.consideration_phase.find((v) => !ALLOWED_CONSIDERATION_PHASES.includes(v));
    if (invalidPhase) errors.push({ field: "consideration_phase", message: "invalid_option" });
  }
  return errors;
}

function getAllowedOrigins(env: Env): string[] {
  const fromEnv = normalizeText(env.ALLOWED_ORIGINS);
  const defaults = ["https://sun-texture-lab.com", "https://www.sun-texture-lab.com"];
  if (!fromEnv) return defaults;
  return fromEnv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin: string | null, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;
  // Preview URLを許可（必要に応じて環境変数で制御）
  return origin.endsWith(".pages.dev");
}

async function verifyTurnstile(token: string, env: Env, remoteIp: string): Promise<boolean> {
  const secret = normalizeText(env.TURNSTILE_SECRET);
  if (!secret) throw new Error("missing_turnstile_secret");

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (remoteIp) form.set("remoteip", remoteIp);

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const result = (await response.json()) as { success?: boolean; ["error-codes"]?: string[] };
  return result.success === true;
}

function base64UrlEncode(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const binary = atob(b64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer.buffer;
}

async function createGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const account = JSON.parse(serviceAccountJson) as { client_email: string; private_key: string };
  if (!account.client_email || !account.private_key) {
    throw new Error("invalid_google_service_account_json");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: account.client_email,
    scope: GOOGLE_SHEETS_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsignedToken));
  const jwt = `${unsignedToken}.${base64UrlEncode(signature)}`;

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`google_token_error_${tokenRes.status}`);
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) throw new Error("google_access_token_missing");
  return tokenJson.access_token;
}

async function appendToSheet(payload: ContactPayload, env: Env, ip: string): Promise<void> {
  const spreadsheetId = normalizeText(env.SPREADSHEET_ID);
  const serviceAccount = normalizeText(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!spreadsheetId || !serviceAccount) throw new Error("missing_google_secrets");

  const accessToken = await createGoogleAccessToken(serviceAccount);
  const timestamp = new Date().toISOString();
  const values = [
    [
      timestamp,
      payload.lp_id,
      payload.lp_version,
      payload.form_schema_version,
      payload.locale,
      payload.country,
      payload.requested_material,
      payload.company,
      payload.department,
      payload.name,
      payload.email,
      payload.phone,
      payload.interest.join(","),
      payload.consideration_phase.join(","),
      payload.message,
      payload.page_url,
      payload.utm_source,
      payload.utm_medium,
      payload.utm_campaign,
      ip,
      "true",
      JSON.stringify(payload),
    ],
  ];

  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId,
  )}/values/responses!A:V:append?valueInputOption=RAW`;

  const response = await fetch(appendUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    throw new Error(`sheet_append_failed_${response.status}`);
  }
}

async function sendMail(env: Env, to: string, subject: string, html: string): Promise<void> {
  const resendApiKey = normalizeText(env.RESEND_API_KEY);
  if (!resendApiKey) throw new Error("missing_resend_api_key");

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // TODO(運用): Resendで認証済みの送信元アドレスに変更する。
      from: "no-reply@sun-texture-lab.com",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    throw new Error(`resend_failed_${response.status}`);
  }
}

function buildAdminMailHtml(payload: ContactPayload, traceId: string, resolved: ResolvedTemplate): string {
  return [
    `<p><strong>trace_id:</strong> ${traceId}</p>`,
    `<p><strong>resolved_template_key:</strong> ${resolved.key}</p>`,
    `<p><strong>template_fallback:</strong> ${resolved.fallback ? "true" : "false"}</p>`,
    `<p><strong>会社名:</strong> ${payload.company}</p>`,
    `<p><strong>お名前:</strong> ${payload.name}</p>`,
    `<p><strong>メール:</strong> ${payload.email}</p>`,
    `<p><strong>ご検討状況:</strong> ${payload.consideration_phase.length ? payload.consideration_phase.join(" / ") : "（未入力）"}</p>`,
    `<p><strong>資料:</strong> ${payload.requested_material}</p>`,
    `<p><strong>LP:</strong> ${payload.lp_id}</p>`,
    `<p><strong>locale/country:</strong> ${payload.locale} / ${payload.country}</p>`,
    `<p><strong>message:</strong> ${payload.message || "（なし）"}</p>`,
  ].join("");
}

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "POST") {
    return json({ ok: false, message: "method_not_allowed" }, 405);
  }

  const traceId = crypto.randomUUID();
  try {
    const origin = context.request.headers.get("origin");
    const allowedOrigins = getAllowedOrigins(context.env);
    if (!isAllowedOrigin(origin, allowedOrigins)) {
      return json({ ok: false, message: "forbidden_origin" }, 403);
    }

    const raw = await context.request.json();
    const payload = parsePayload(raw);
    const errors = validate(payload);
    if (errors.length > 0) {
      return json({ ok: false, message: "validation_error", fields: errors }, 400);
    }

    const remoteIp = normalizeText(context.request.headers.get("CF-Connecting-IP"));
    const turnstileOk = await verifyTurnstile(payload.turnstileToken, context.env, remoteIp);
    if (!turnstileOk) {
      return json({ ok: false, message: "turnstile_failed" }, 403);
    }

    await appendToSheet(payload, context.env, remoteIp);

    const adminTo = normalizeText(context.env.ADMIN_EMAIL) || SUPPORT_EMAIL_DEFAULT;
    const resolvedTemplate = resolveTemplate(payload);
    const renderedTemplate = renderTemplate(resolvedTemplate.template, payload, traceId, adminTo);
    console.info("user_mail_template_resolved", {
      traceId,
      resolved_template_key: resolvedTemplate.key,
      template_fallback: resolvedTemplate.fallback,
      lp_id: payload.lp_id,
      locale: payload.locale,
      requested_material: payload.requested_material,
    });

    let mailWarning = false;
    try {
      await sendMail(context.env, payload.email, renderedTemplate.subject, renderedTemplate.bodyHtml);
      await sendMail(
        context.env,
        adminTo,
        `【LP問い合わせ通知】${new Date().toISOString()}`,
        buildAdminMailHtml(payload, traceId, resolvedTemplate),
      );
    } catch (mailError) {
      mailWarning = true;
      console.error("mail_send_failed", { traceId, error: String(mailError) });
    }

    if (mailWarning) {
      return json({ ok: true, message: "accepted", trace_id: traceId, mail_warning: true }, 200);
    }
    return json({ ok: true, message: "sent", trace_id: traceId }, 200);
  } catch (error) {
    console.error("contact_api_error", { traceId, error: String(error) });
    return json({ ok: false, message: "internal_error", trace_id: traceId }, 500);
  }
};
