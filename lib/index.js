/**
 * dsh-tolerance — 公差链与配合查询
 */

export const name = "dsh-tolerance";
export const inject = ["tools"];

const NL = String.fromCharCode(10);
const SITE = "https://deepseekbase.com/zh/tools/";
const TEXT_OUTPUT = {
  schema: { type: "object", additionalProperties: false, properties: { text: { type: "string" } }, required: ["text"] },
  render: (_args, value) => [{ type: "text", text: (value && value.text) || "" }],
};

const FITS = {
  "H7/g6": { type: "间隙配合", desc: "滑动/定位，常用" },
  "H7/h6": { type: "间隙配合", desc: "定位，最小间隙 0" },
  "H7/k6": { type: "过渡配合", desc: "定位+轻压入" },
  "H7/n6": { type: "过渡配合", desc: "较紧定位" },
  "H7/p6": { type: "过盈配合", desc: "压入" },
  "H7/s6": { type: "过盈配合", desc: "重压入/热装" },
  "H8/f7": { type: "间隙配合", desc: "转动/滑动" },
  "H9/d9": { type: "间隙配合", desc: "大间隙" },
};

const PROCESS_RA = [
  ["粗车", 12.5, 6.3], ["精车", 3.2, 1.6], ["粗铣", 12.5, 6.3], ["精铣", 3.2, 1.6],
  ["钻孔", 12.5, 6.3], ["铰孔", 1.6, 0.8], ["磨削", 0.8, 0.2], ["研磨", 0.1, 0.025],
  ["电火花", 3.2, 1.6], ["线切割", 3.2, 1.6],
];

function n(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }
function f(x) { return (Math.round(x * 1000) / 1000).toString(); }

const TOOLS = {
  tolerance_stack: {
    description: "公差链计算：给出各环尺寸与公差，输出最坏情况与均方根（RSS）总公差",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        nominal: { type: "number", description: "封闭环标称尺寸 mm" },
        tolerances: { type: "string", description: "各组成环公差，逗号分隔，如 0.1,0.05,0.02" },
        method: { type: "string", enum: ["worst", "rss", "both"], description: "计算方法，默认 both" },
      },
      required: ["nominal", "tolerances"],
    },
    run(args) {
      const parts = String(args.tolerances || "").split(",").map((x) => n(x.trim(), NaN)).filter((x) => Number.isFinite(x));
      if (!parts.length) throw new Error("tolerances 需为逗号分隔的数字");
      const method = String(args.method || "both");
      const worst = parts.reduce((a, b) => a + b, 0);
      const rss = Math.sqrt(parts.reduce((a, b) => a + b * b, 0));
      const N = n(args.nominal, 0);
      const lines = ["公差链计算", "=".repeat(52), "标称: " + f(N) + " mm", "组成环: " + parts.map(f).join(" + ") + "（" + parts.length + " 环）", ""];
      if (method === "worst" || method === "both") {
        lines.push("最坏情况: ±" + f(worst) + " mm → " + f(N - worst) + " ~ " + f(N + worst) + " mm");
      }
      if (method === "rss" || method === "both") {
        lines.push("RSS: ±" + f(rss) + " mm → " + f(N - rss) + " ~ " + f(N + rss) + " mm");
      }
      lines.push("");
      lines.push("最坏情况用于保守校核；RSS 假设各环独立正态，需过程能力支撑。");
      lines.push("");
      lines.push("更多工具：" + SITE);
      return lines.join(NL);
    },
  },
  fit_lookup: {
    description: "配合查询：输入配合代号（如 H7/g6），输出配合类型与典型用途",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { fit: { type: "string", description: "配合代号，如 H7/g6" } },
      required: ["fit"],
    },
    run(args) {
      const key = String(args.fit || "").replace(/\s+/g, "").toUpperCase();
      const hit = FITS[key];
      const lines = ["配合查询", "=".repeat(52), "配合: " + key];
      if (hit) {
        lines.push("类型: " + hit.type);
        lines.push("说明: " + hit.desc);
      } else {
        lines.push("未收录该配合。常用: " + Object.keys(FITS).join(" / "));
      }
      lines.push("");
      lines.push("具体极限偏差需查 GB/T 1800 或 ISO 286 表，本工具只给类型与用途。");
      lines.push("");
      lines.push("更多工具：" + SITE);
      return lines.join(NL);
    },
  },
  surface_finish: {
    description: "表面粗糙度：按加工工艺给可达 Ra 范围，并做 Ra/Rz 近似换算",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        process: { type: "string", description: "加工工艺，如 精铣 / 磨削（可选）" },
        ra: { type: "number", description: "已知 Ra µm（可选）" },
      },
      required: [],
    },
    run(args) {
      const lines = ["表面粗糙度", "=".repeat(52)];
      const p = String(args.process || "").trim();
      if (p) {
        const row = PROCESS_RA.find((x) => p.indexOf(x[0]) >= 0 || x[0].indexOf(p) >= 0);
        if (row) lines.push(row[0] + " 可达 Ra: " + row[1] + " ~ " + row[2] + " µm");
        else lines.push("未收录该工艺。常见: " + PROCESS_RA.map((x) => x[0]).join(" / "));
      }
      if (args.ra != null) {
        const ra = n(args.ra, 0);
        lines.push("Ra " + ra + " µm ≈ Rz " + f(ra * 4) + " µm ≈ Rmax " + f(ra * 6) + " µm（近似，比例随工艺变化）");
      }
      if (!p && args.ra == null) throw new Error("请给 process 或 ra");
      lines.push("");
      lines.push("Ra/Rz 换算为经验近似，验收以图纸标注与量具实测为准。");
      lines.push("");
      lines.push("更多工具：" + SITE);
      return lines.join(NL);
    },
  },
};

export function apply(ctx, config) {
  void config;
  for (const name of Object.keys(TOOLS)) {
    const t = TOOLS[name];
    ctx.tools.register({
      name: name,
      description: t.description,
      parameters: t.parameters,
      output: TEXT_OUTPUT,
      async execute(args) { try { return { text: t.run(args || {}) }; } catch (e) { return { text: "处理失败: " + String((e && e.message) || e) }; } },
    });
  }
}
