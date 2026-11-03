import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "芯链 CoreLink · 企业电子物料管理",
  description:
    "从产品、PCBA / TLA 总成到企业物料与制造供应链，一处关联，清晰可见。",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
